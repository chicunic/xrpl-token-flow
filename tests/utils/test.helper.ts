import { expect } from 'vitest';
import {
  type AccountDelete,
  type AccountLinesTrustline,
  type AccountSet,
  AccountSetAsfFlags,
  type Client,
  convertStringToHex,
  dropsToXrp,
  type Payment,
  type SubmittableTransaction,
  type TransactionMetadata,
  type TrustSet,
  Wallet,
} from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient } from '@/config/xrpl.config';
import { fundWallet } from '@/services/fund.service';
import { CURRENCY, DOMAIN, TRUST_AMOUNT } from './data';

export function currencyToHex(currency: string): string {
  return convertStringToHex(currency).padEnd(40, '0');
}

export async function submitTransaction(
  client: Client,
  tx: SubmittableTransaction,
  signer: Wallet,
  expectedResult = 'tesSUCCESS'
): Promise<TransactionMetadata> {
  const signed = signer.sign(tx);
  const result = await client.submitAndWait(signed.tx_blob);
  const meta = result.result.meta as TransactionMetadata;
  expect(meta.TransactionResult).toBe(expectedResult);
  return meta;
}

export async function getAccountFlags(client: Client, address: string): Promise<bigint> {
  const accountInfo = await client.request({
    command: 'account_info',
    account: address,
    ledger_index: 'validated',
  });
  return BigInt(accountInfo.result.account_data.Flags || 0);
}

// Check whether a specific account root flag is set
export function hasFlag(flags: bigint, flag: number): boolean {
  return (flags & BigInt(flag)) === BigInt(flag);
}

// Find a specific trust line between a wallet and an issuer
export async function findTrustLine(
  wallet: Wallet,
  issuer: Wallet,
  currency = CURRENCY
): Promise<AccountLinesTrustline | undefined> {
  const client = getXRPLClient();
  const accountLines = await client.request({
    command: 'account_lines',
    account: wallet.address,
    peer: issuer.address,
  });
  return accountLines.result.lines.find(
    (l: AccountLinesTrustline) => l.currency === currencyToHex(currency) && l.account === issuer.address
  );
}

// Generate and fund multiple wallets, verifying each has the expected balance
export async function setupWallets(count: number, fundAmount = '2'): Promise<Wallet[]> {
  const wallets = Array.from({ length: count }, () => Wallet.generate());

  for (const wallet of wallets) {
    await fundWallet(wallet, { amount: fundAmount });
  }

  const client = getXRPLClient();
  for (const wallet of wallets) {
    const info = await client.request({
      command: 'account_info',
      account: wallet.address,
      ledger_index: 'validated',
    });
    expect(dropsToXrp(info.result.account_data.Balance)).toEqual(Number(fundAmount));
  }

  return wallets;
}

// Configure an issuer account with DefaultRipple and optional additional flags
export async function setupIssuerWithFlags(issuer: Wallet, flags: AccountSetAsfFlags[] = []): Promise<void> {
  const client = getXRPLClient();

  const setupTx: AccountSet = await client.autofill({
    TransactionType: 'AccountSet',
    Account: issuer.address,
    Domain: convertStringToHex(DOMAIN),
    SetFlag: AccountSetAsfFlags.asfDefaultRipple,
  });
  await submitTransaction(client, setupTx, issuer);

  for (const flag of flags) {
    const flagTx: AccountSet = await client.autofill({
      TransactionType: 'AccountSet',
      Account: issuer.address,
      SetFlag: flag,
    });
    await submitTransaction(client, flagTx, issuer);
  }

  const accountFlags = await getAccountFlags(client, issuer.address);
  expect(hasFlag(accountFlags, AccountRootFlags.lsfDefaultRipple)).toBe(true);
}

// Create a trust line from a wallet to an issuer
export async function createTrustLine(
  wallet: Wallet,
  issuer: Wallet,
  currency = CURRENCY,
  limit = TRUST_AMOUNT
): Promise<void> {
  const client = getXRPLClient();

  const trustTx: TrustSet = await client.autofill({
    TransactionType: 'TrustSet',
    Account: wallet.address,
    LimitAmount: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: limit,
    },
  });
  await submitTransaction(client, trustTx, wallet);

  const line = await findTrustLine(wallet, issuer, currency);
  expect(line).toBeDefined();
  expect(line?.limit).toBe(limit);
}

// Mint (issue) tokens from issuer to destination
export async function mintTokens(issuer: Wallet, dest: Wallet, amount: string, currency = CURRENCY): Promise<void> {
  const client = getXRPLClient();

  const mintTx: Payment = await client.autofill({
    TransactionType: 'Payment',
    Account: issuer.address,
    Destination: dest.address,
    Amount: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: amount,
    },
  });
  await submitTransaction(client, mintTx, issuer);
}

// Get the token balance of a wallet for a specific issuer/currency
export async function getTokenBalance(wallet: Wallet, issuer: Wallet, currency = CURRENCY): Promise<string> {
  const line = await findTrustLine(wallet, issuer, currency);
  return line?.balance ?? '0';
}

// ─── Account Cleanup (AccountDelete) ───────────────────────────────────────

// Delete all trust lines for a wallet, returning tokens to issuer if needed
export async function deleteTrustLines(client: Client, wallet: Wallet): Promise<void> {
  const accountLines = await client.request({
    command: 'account_lines',
    account: wallet.address,
  });
  for (const line of accountLines.result.lines) {
    const balance = Number(line.balance);
    // If positive balance, send tokens back to issuer
    if (balance > 0) {
      const payTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: line.account,
        Amount: {
          currency: line.currency,
          issuer: line.account,
          value: line.balance,
        },
      });
      await submitTransaction(client, payTx, wallet);
    }
    // Set trust line limit to 0 to delete it
    const trustTx: TrustSet = await client.autofill({
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: line.currency,
        issuer: line.account,
        value: '0',
      },
    });
    await submitTransaction(client, trustTx, wallet);
  }
}

// Delete account and send remaining XRP to fund wallet (requires 256 ledgers since creation)
export async function deleteAccount(client: Client, wallet: Wallet): Promise<void> {
  const fundSecret = process.env.FUND_SECRET;
  if (!fundSecret) return;
  const fundAddress = Wallet.fromSecret(fundSecret).address;

  try {
    await deleteTrustLines(client, wallet);

    const tx: AccountDelete = await client.autofill({
      TransactionType: 'AccountDelete',
      Account: wallet.address,
      Destination: fundAddress,
    });
    const signed = wallet.sign(tx);
    await client.submitAndWait(signed.tx_blob);
    console.log(`♻️ Deleted account ${wallet.address} and reclaimed XRP to fund`);
  } catch (error) {
    console.log(`⚠️ Failed to delete account ${wallet.address}: ${error}`);
  }
}
