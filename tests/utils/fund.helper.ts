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
import { getXRPLClient } from "@/config/xrpl.config.js";

const XRP_MINIMUM_DROPS = BigInt(xrpToDrops(2));

// Genesis account on standalone rippled (local mode)
const GENESIS_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

// Parallel test files pay from one source account, so concurrent autofill() can collide on Sequence; retry on conflict.
const SEQUENCE_RETRY_RESULTS = ["tefPAST_SEQ", "terPRE_SEQ", "tefALREADY"];
const MAX_FUND_ATTEMPTS = 6;

function isSequenceConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return SEQUENCE_RETRY_RESULTS.some((code) => message.includes(code));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ActNotFoundError extends XrplError {
  data?: {
    error?: string;
  };
}

function getFundWallet(): Wallet {
  return Wallet.fromSeed(GENESIS_SEED, { algorithm: ECDSA.secp256k1 });
}

export async function fundWallet(wallet: Wallet, { amount }: { amount: string }): Promise<void> {
  for (let attempt = 1; attempt <= MAX_FUND_ATTEMPTS; attempt++) {
    try {
      await fundWalletImpl(wallet, { amount });
      return;
    } catch (error: unknown) {
      if (!isSequenceConflict(error) || attempt === MAX_FUND_ATTEMPTS) {
        throw error;
      }
      // Another concurrent funder won the sequence; back off briefly and re-autofill.
      await delay(200 * attempt);
    }
  }
}

async function fundWalletImpl(wallet: Wallet, { amount }: { amount: string }): Promise<void> {
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
      throw new Error(`Fund wallet (${sourceWallet.address}) does not exist on the network. Is local node running?`, {
        cause: error,
      });
    }
    throw error;
  }

  console.log(`📤 Requested transfer: ${String(dropsToXrp(amountDrops))} XRP to ${targetAddress}`);
  if (currentBalanceDrops < amountDrops + XRP_MINIMUM_DROPS) {
    throw new Error(
      `Insufficient genesis balance. Need: ${String(dropsToXrp(amountDrops + XRP_MINIMUM_DROPS))} XRP, Have: ${String(dropsToXrp(currentBalanceDrops))} XRP`,
    );
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
