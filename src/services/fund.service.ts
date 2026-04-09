import 'dotenv/config';
import {
  type Client,
  dropsToXrp,
  type Payment,
  type TransactionMetadata,
  Wallet,
  type XrplError,
  xrpToDrops,
} from 'xrpl';
import { getXRPLClient } from '../config/xrpl.config';

const XRP_MINIMUM_DROPS = BigInt(xrpToDrops(2));

interface ActNotFoundError extends XrplError {
  data?: {
    error?: string;
  };
}

function getFundWallet(): Wallet {
  const secret = process.env.FUND_SECRET;
  if (!secret) {
    throw new Error('FUND_SECRET is not set in .env');
  }
  return Wallet.fromSecret(secret);
}

export async function fundWallet(wallet: Wallet, { amount }: { amount: string }): Promise<void> {
  const amountDrops = BigInt(xrpToDrops(amount));
  const minDrops = BigInt(xrpToDrops('1'));
  const maxDrops = BigInt(xrpToDrops('100'));
  if (amountDrops < minDrops || amountDrops > maxDrops) {
    throw new Error('Amount must be between 1 and 100 XRP');
  }
  const sourceWallet = getFundWallet();
  const client: Client = getXRPLClient();
  const targetAddress = wallet.address;
  let targetBalanceDrops = 0n;
  let targetExists = true;
  try {
    const targetAccountInfo = await client.request({
      command: 'account_info',
      account: targetAddress,
      ledger_index: 'validated',
    });
    targetBalanceDrops = BigInt(targetAccountInfo.result.account_data.Balance);
    console.log(`🔍 Target address (${targetAddress}) current balance: ${dropsToXrp(targetBalanceDrops)} XRP`);
  } catch (error: unknown) {
    if ((error as ActNotFoundError)?.data?.error === 'actNotFound') {
      console.log(`🔍 Target address (${targetAddress}) does not exist yet - will be created by funding`);
      targetExists = false;
    } else {
      throw error;
    }
  }
  if (targetExists && targetBalanceDrops >= amountDrops) {
    console.log(
      `✅ Target address already has sufficient balance (${dropsToXrp(targetBalanceDrops)} XRP >= ${dropsToXrp(amountDrops)} XRP). No transfer needed.`
    );
    return;
  }
  let currentBalanceDrops = 0n;
  try {
    const fundAccountInfo = await client.request({
      command: 'account_info',
      account: sourceWallet.address,
      ledger_index: 'validated',
    });
    currentBalanceDrops = BigInt(fundAccountInfo.result.account_data.Balance);
    console.log(`💰 Fund wallet (${sourceWallet.address}) balance: ${dropsToXrp(currentBalanceDrops)} XRP`);
  } catch (error: unknown) {
    if ((error as ActNotFoundError)?.data?.error === 'actNotFound') {
      throw new Error(`Fund wallet (${sourceWallet.address}) does not exist on the network. Please fund it first.`);
    }
    throw error;
  }
  console.log(`📤 Requested transfer: ${dropsToXrp(amountDrops)} XRP to ${targetAddress}`);
  if (currentBalanceDrops < amountDrops + XRP_MINIMUM_DROPS) {
    console.log(
      `⚠️  Insufficient balance. Need: ${dropsToXrp(amountDrops + XRP_MINIMUM_DROPS)} XRP, Have: ${dropsToXrp(currentBalanceDrops)} XRP`
    );
    console.log('🔄 Auto-funding from faucet...');
    await client.fundWallet(sourceWallet, { amount: '100' });
    const updatedAccountInfo = await client.request({
      command: 'account_info',
      account: sourceWallet.address,
      ledger_index: 'validated',
    });
    currentBalanceDrops = BigInt(updatedAccountInfo.result.account_data.Balance);
    console.log(`💰 Updated fund wallet balance: ${dropsToXrp(currentBalanceDrops)} XRP`);
    if (currentBalanceDrops < amountDrops + XRP_MINIMUM_DROPS) {
      throw new Error(
        `Still insufficient after faucet. Need: ${dropsToXrp(amountDrops + XRP_MINIMUM_DROPS)} XRP, Have: ${dropsToXrp(currentBalanceDrops)} XRP`
      );
    }
  }
  const paymentTx: Payment = await client.autofill({
    TransactionType: 'Payment',
    Account: sourceWallet.address,
    Destination: targetAddress,
    Amount: xrpToDrops(amount),
  });
  const signed = sourceWallet.sign(paymentTx);
  const result = await client.submitAndWait(signed.tx_blob);
  const transactionResult = (result.result.meta as TransactionMetadata)?.TransactionResult;
  if (transactionResult !== 'tesSUCCESS') {
    throw new Error(`Transfer failed with result: ${transactionResult}`);
  }
  const txHash = result.result.hash;
  console.log(`✅ Successfully transferred ${amount} XRP to ${targetAddress}`);
  console.log(`📝 Fund to ${targetAddress} transaction hash: ${txHash}`);
}
