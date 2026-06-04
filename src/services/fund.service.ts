import "dotenv/config";
import {
  type Client,
  ECDSA,
  type Payment,
  type TransactionMetadata,
  Wallet,
  type XrplError,
  dropsToXrp,
  xrpToDrops,
} from "xrpl";
import { getXRPLClient } from "../config/xrpl.config";

const XRP_MINIMUM_DROPS = BigInt(xrpToDrops(2));

// Genesis account on standalone rippled (local mode)
const GENESIS_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

interface ActNotFoundError extends XrplError {
  data?: {
    error?: string;
  };
}

function isLocalNetwork(): boolean {
  return process.env.XRPL_NETWORK === "local";
}

function getFundWallet(): Wallet {
  if (isLocalNetwork()) {
    return Wallet.fromSeed(GENESIS_SEED, { algorithm: ECDSA.secp256k1 });
  }
  const secret = process.env.FUND_SECRET;
  if (!secret) {
    throw new Error("FUND_SECRET is not set in .env");
  }
  return Wallet.fromSecret(secret);
}

export async function fundWallet(wallet: Wallet, { amount }: { amount: string }): Promise<void> {
  const amountDrops = BigInt(xrpToDrops(amount));
  const minDrops = BigInt(xrpToDrops("1"));
  const maxDrops = BigInt(xrpToDrops("100"));
  if (amountDrops < minDrops || amountDrops > maxDrops) {
    throw new Error("Amount must be between 1 and 100 XRP");
  }
  const sourceWallet = getFundWallet();
  const client: Client = getXRPLClient();
  const targetAddress = wallet.address;
  let targetBalanceDrops = 0n;
  let targetExists = true;
  try {
    const targetAccountInfo = await client.request({
      command: "account_info",
      account: targetAddress,
      ledger_index: "validated",
    });
    targetBalanceDrops = BigInt(targetAccountInfo.result.account_data.Balance);
    console.log(`🔍 Target address (${targetAddress}) current balance: ${String(dropsToXrp(targetBalanceDrops))} XRP`);
  } catch (error: unknown) {
    const err = error as Partial<ActNotFoundError>;
    if (err.data?.error === "actNotFound") {
      console.log(`🔍 Target address (${targetAddress}) does not exist yet - will be created by funding`);
      targetExists = false;
    } else {
      throw error;
    }
  }
  if (targetExists && targetBalanceDrops >= amountDrops) {
    console.log(
      `✅ Target address already has sufficient balance (${String(dropsToXrp(targetBalanceDrops))} XRP >= ${String(dropsToXrp(amountDrops))} XRP). No transfer needed.`,
    );
    return;
  }
  let currentBalanceDrops: bigint;
  try {
    const fundAccountInfo = await client.request({
      command: "account_info",
      account: sourceWallet.address,
      ledger_index: "validated",
    });
    currentBalanceDrops = BigInt(fundAccountInfo.result.account_data.Balance);
    console.log(`💰 Fund wallet (${sourceWallet.address}) balance: ${String(dropsToXrp(currentBalanceDrops))} XRP`);
  } catch (error: unknown) {
    const err = error as Partial<ActNotFoundError>;
    if (err.data?.error === "actNotFound") {
      throw new Error(`Fund wallet (${sourceWallet.address}) does not exist on the network. Please fund it first.`, {
        cause: error,
      });
    }
    throw error;
  }
  console.log(`📤 Requested transfer: ${String(dropsToXrp(amountDrops))} XRP to ${targetAddress}`);
  if (currentBalanceDrops < amountDrops + XRP_MINIMUM_DROPS) {
    if (isLocalNetwork()) {
      throw new Error(
        `Insufficient genesis balance. Need: ${String(dropsToXrp(amountDrops + XRP_MINIMUM_DROPS))} XRP, Have: ${String(dropsToXrp(currentBalanceDrops))} XRP`,
      );
    }
    console.log(
      `⚠️  Insufficient balance. Need: ${String(dropsToXrp(amountDrops + XRP_MINIMUM_DROPS))} XRP, Have: ${String(dropsToXrp(currentBalanceDrops))} XRP`,
    );
    console.log("🔄 Auto-funding from faucet...");
    await client.fundWallet(sourceWallet, { amount: "100" });
    const updatedAccountInfo = await client.request({
      command: "account_info",
      account: sourceWallet.address,
      ledger_index: "validated",
    });
    currentBalanceDrops = BigInt(updatedAccountInfo.result.account_data.Balance);
    console.log(`💰 Updated fund wallet balance: ${String(dropsToXrp(currentBalanceDrops))} XRP`);
    if (currentBalanceDrops < amountDrops + XRP_MINIMUM_DROPS) {
      throw new Error(
        `Still insufficient after faucet. Need: ${String(dropsToXrp(amountDrops + XRP_MINIMUM_DROPS))} XRP, Have: ${String(dropsToXrp(currentBalanceDrops))} XRP`,
      );
    }
  }
  const paymentTx: Payment = await client.autofill({
    TransactionType: "Payment",
    Account: sourceWallet.address,
    Destination: targetAddress,
    Amount: xrpToDrops(amount),
  });
  const signed = sourceWallet.sign(paymentTx);
  const result = await client.submitAndWait(signed.tx_blob);
  const meta = result.result.meta as TransactionMetadata | undefined;
  const transactionResult = meta?.TransactionResult;
  if (transactionResult !== "tesSUCCESS") {
    throw new Error(`Transfer failed with result: ${String(transactionResult)}`);
  }
  const txHash = result.result.hash;
  console.log(`✅ Successfully transferred ${amount} XRP to ${targetAddress}`);
  console.log(`📝 Fund to ${targetAddress} transaction hash: ${txHash}`);
}
