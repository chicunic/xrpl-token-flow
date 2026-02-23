// Fund Service: transfers XRP from an environment-configured wallet to target addresses
import * as bip39 from 'bip39';
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

const XRP_MINIMUM_DROPS = BigInt(xrpToDrops(2)); // XRP minimum reserve requirement

interface ActNotFoundError extends XrplError {
  data?: {
    error?: string;
  };
}

function ensureFundMnemonic(): string {
  const envMnemonic = process.env.FUND_MNEMONIC;
  if (envMnemonic && bip39.validateMnemonic(envMnemonic)) {
    return envMnemonic;
  }

  const newMnemonic = bip39.generateMnemonic();
  const wallet = Wallet.fromMnemonic(newMnemonic);
  console.log('🔑 Generated new FUND_MNEMONIC for wallet:', wallet.address);

  const envPath = join(process.cwd(), '.env');
  let envContent = '';

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf8')
      .replace(/^FUND_MNEMONIC=.*$/m, '')
      .replace(/\n\n+/g, '\n')
      .trim();
  }

  if (envContent && !envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `FUND_MNEMONIC=${newMnemonic}\n`;
  writeFileSync(envPath, envContent);
  console.log('✅ Updated .env file with new FUND_MNEMONIC');

  process.env.FUND_MNEMONIC = newMnemonic;
  return newMnemonic;
}

export async function fundWallet(wallet: Wallet, { amount }: { amount: string }): Promise<void> {
  const amountDrops = BigInt(xrpToDrops(amount));
  const minDrops = BigInt(xrpToDrops('1'));
  const maxDrops = BigInt(xrpToDrops('100'));
  if (amountDrops < minDrops || amountDrops > maxDrops) {
    throw new Error('Amount must be between 1 and 100 XRP');
  }

  const fundMnemonic = ensureFundMnemonic();

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

  const sourceWallet = Wallet.fromMnemonic(fundMnemonic);
  let currentBalanceDrops = 0n;
  let sourceWalletExists = true;

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
      console.log(`💰 Fund wallet (${sourceWallet.address}) does not exist yet - will be created by faucet funding`);
      sourceWalletExists = false;
    } else {
      throw error;
    }
  }

  console.log(`📤 Requested transfer: ${dropsToXrp(amountDrops)} XRP to ${targetAddress}`);

  if (!sourceWalletExists || currentBalanceDrops < amountDrops + XRP_MINIMUM_DROPS) {
    console.log(
      `⚠️  Insufficient balance. Need: ${dropsToXrp(amountDrops + XRP_MINIMUM_DROPS)} XRP, Have: ${dropsToXrp(currentBalanceDrops)} XRP`
    );
    console.log('🔄 Auto-funding wallet with 100 XRP from faucet...');

    await client.fundWallet(sourceWallet, { amount: '100' });
    console.log('✅ Successfully funded wallet with 100 XRP');

    const updatedAccountInfo = await client.request({
      command: 'account_info',
      account: sourceWallet.address,
      ledger_index: 'validated',
    });
    const updatedBalanceDrops = BigInt(updatedAccountInfo.result.account_data.Balance);
    console.log(`💰 Updated fund wallet balance: ${dropsToXrp(updatedBalanceDrops)} XRP`);

    if (updatedBalanceDrops < amountDrops + XRP_MINIMUM_DROPS) {
      throw new Error(
        `Still insufficient balance after auto-funding. Need: ${dropsToXrp(amountDrops + XRP_MINIMUM_DROPS)} XRP, Have: ${dropsToXrp(updatedBalanceDrops)} XRP`
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
