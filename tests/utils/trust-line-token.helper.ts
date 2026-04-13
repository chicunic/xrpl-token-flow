import type {
  AccountSet,
  CheckCancel,
  CheckCash,
  CheckCreate,
  Clawback,
  CreatedNode,
  DepositPreauth,
  Payment,
  TrustSet,
  Wallet,
} from 'xrpl';
import { type AccountSetAsfFlags, TrustSetFlags, xrpToDrops } from 'xrpl';

import { getXRPLClient } from '@/config/xrpl.config';
import { CURRENCY, DOMAIN } from './data';
import { currencyToHex, getAccountFlags, hasFlag, submitTransaction } from './test.helper';

// ─── Account Flag Operations ────────────────────────────────────────────────

export async function setAccountFlag(wallet: Wallet, flag: AccountSetAsfFlags): Promise<void> {
  const client = getXRPLClient();
  const tx: AccountSet = await client.autofill({
    TransactionType: 'AccountSet',
    Account: wallet.address,
    SetFlag: flag,
  });
  await submitTransaction(client, tx, wallet);
}

export async function clearAccountFlag(wallet: Wallet, flag: AccountSetAsfFlags): Promise<void> {
  const client = getXRPLClient();
  const tx: AccountSet = await client.autofill({
    TransactionType: 'AccountSet',
    Account: wallet.address,
    ClearFlag: flag,
  });
  await submitTransaction(client, tx, wallet);
}

export async function setupIssuerWithDomain(wallet: Wallet): Promise<void> {
  const client = getXRPLClient();
  const { convertStringToHex } = await import('xrpl');
  const tx: AccountSet = await client.autofill({
    TransactionType: 'AccountSet',
    Account: wallet.address,
    Domain: convertStringToHex(DOMAIN),
  });
  await submitTransaction(client, tx, wallet);
}

export async function verifyAccountFlag(address: string, rootFlag: number, expected: boolean): Promise<void> {
  const client = getXRPLClient();
  const flags = await getAccountFlags(client, address);
  expect(hasFlag(flags, rootFlag)).toBe(expected);
}

// ─── Transfer Rate Operations ───────────────────────────────────────────────

export async function setTransferRate(issuer: Wallet, transferRate: number): Promise<void> {
  const client = getXRPLClient();
  const tx: AccountSet = await client.autofill({
    TransactionType: 'AccountSet',
    Account: issuer.address,
    TransferRate: transferRate,
  });
  await submitTransaction(client, tx, issuer);
}

// ─── Trust Line Operations ──────────────────────────────────────────────────

export async function freezeTrustLine(issuer: Wallet, user: Wallet, currency = CURRENCY): Promise<void> {
  const client = getXRPLClient();
  const tx: TrustSet = await client.autofill({
    TransactionType: 'TrustSet',
    Account: issuer.address,
    LimitAmount: {
      currency: currencyToHex(currency),
      issuer: user.address,
      value: '0',
    },
    Flags: TrustSetFlags.tfSetFreeze,
  });
  await submitTransaction(client, tx, issuer);
}

export async function unfreezeTrustLine(issuer: Wallet, user: Wallet, currency = CURRENCY): Promise<void> {
  const client = getXRPLClient();
  const tx: TrustSet = await client.autofill({
    TransactionType: 'TrustSet',
    Account: issuer.address,
    LimitAmount: {
      currency: currencyToHex(currency),
      issuer: user.address,
      value: '0',
    },
    Flags: TrustSetFlags.tfClearFreeze,
  });
  await submitTransaction(client, tx, issuer);
}

export async function clearNoRippleOnTrustLine(issuer: Wallet, user: Wallet, currency = CURRENCY): Promise<void> {
  const client = getXRPLClient();
  const tx: TrustSet = await client.autofill({
    TransactionType: 'TrustSet',
    Account: issuer.address,
    LimitAmount: {
      currency: currencyToHex(currency),
      issuer: user.address,
      value: '0',
    },
    Flags: TrustSetFlags.tfClearNoRipple,
  });
  await submitTransaction(client, tx, issuer);
}

export async function authorizeTrustLine(issuer: Wallet, user: Wallet, currency = CURRENCY): Promise<void> {
  const client = getXRPLClient();
  const tx: TrustSet = await client.autofill({
    TransactionType: 'TrustSet',
    Account: issuer.address,
    LimitAmount: {
      currency: currencyToHex(currency),
      issuer: user.address,
      value: '0',
    },
    Flags: TrustSetFlags.tfSetfAuth,
  });
  await submitTransaction(client, tx, issuer);
}

// ─── Token Transfer Operations ──────────────────────────────────────────────

export async function transferTokens(
  sender: Wallet,
  dest: Wallet,
  amount: string,
  issuer: Wallet,
  expectedResult = 'tesSUCCESS',
  currency = CURRENCY
): Promise<void> {
  const client = getXRPLClient();
  const tx: Payment = await client.autofill({
    TransactionType: 'Payment',
    Account: sender.address,
    Destination: dest.address,
    Amount: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: amount,
    },
  });
  await submitTransaction(client, tx, sender, expectedResult);
}

export async function transferTokensWithSendMax(
  sender: Wallet,
  dest: Wallet,
  amount: string,
  sendMax: string,
  issuer: Wallet,
  currency = CURRENCY
): Promise<void> {
  const client = getXRPLClient();
  const tx: Payment = await client.autofill({
    TransactionType: 'Payment',
    Account: sender.address,
    Destination: dest.address,
    Amount: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: amount,
    },
    SendMax: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: sendMax,
    },
  });
  await submitTransaction(client, tx, sender);
}

export async function transferXRP(
  sender: Wallet,
  dest: Wallet,
  xrpAmount: string,
  expectedResult = 'tesSUCCESS'
): Promise<void> {
  const client = getXRPLClient();
  const tx: Payment = await client.autofill({
    TransactionType: 'Payment',
    Account: sender.address,
    Destination: dest.address,
    Amount: xrpToDrops(xrpAmount),
  });
  await submitTransaction(client, tx, sender, expectedResult);
}

// ─── Clawback Operations ────────────────────────────────────────────────────

export async function clawbackTokens(
  issuer: Wallet,
  holder: Wallet,
  amount: string,
  currency = CURRENCY
): Promise<void> {
  const client = getXRPLClient();
  const tx: Clawback = await client.autofill({
    TransactionType: 'Clawback',
    Account: issuer.address,
    Amount: {
      currency: currencyToHex(currency),
      issuer: holder.address,
      value: amount,
    },
  });
  await submitTransaction(client, tx, issuer);
}

// ─── Deposit Preauth Operations ─────────────────────────────────────────────

export async function preauthorizeSender(receiver: Wallet, sender: Wallet): Promise<void> {
  const client = getXRPLClient();
  const tx: DepositPreauth = await client.autofill({
    TransactionType: 'DepositPreauth',
    Account: receiver.address,
    Authorize: sender.address,
  });
  await submitTransaction(client, tx, receiver);
}

export async function revokeSenderPreauth(receiver: Wallet, sender: Wallet): Promise<void> {
  const client = getXRPLClient();
  const tx: DepositPreauth = await client.autofill({
    TransactionType: 'DepositPreauth',
    Account: receiver.address,
    Unauthorize: sender.address,
  });
  await submitTransaction(client, tx, receiver);
}

// ─── Check Operations ───────────────────────────────────────────────────────

export async function createCheck(
  sender: Wallet,
  receiver: Wallet,
  amount: string,
  issuer: Wallet,
  currency = CURRENCY
): Promise<string> {
  const client = getXRPLClient();
  const tx: CheckCreate = await client.autofill({
    TransactionType: 'CheckCreate',
    Account: sender.address,
    Destination: receiver.address,
    SendMax: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: amount,
    },
  });
  const meta = await submitTransaction(client, tx, sender);

  const createdNode = meta.AffectedNodes?.find(node => (node as CreatedNode).CreatedNode?.LedgerEntryType === 'Check');
  const checkId = (createdNode as CreatedNode)?.CreatedNode?.LedgerIndex;
  expect(checkId).toBeDefined();

  return checkId!;
}

export async function cashCheck(
  receiver: Wallet,
  checkId: string,
  amount: string,
  issuer: Wallet,
  currency = CURRENCY
): Promise<void> {
  const client = getXRPLClient();
  const tx: CheckCash = await client.autofill({
    TransactionType: 'CheckCash',
    Account: receiver.address,
    CheckID: checkId,
    Amount: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: amount,
    },
  });
  await submitTransaction(client, tx, receiver);
}

export async function cancelCheck(wallet: Wallet, checkId: string): Promise<void> {
  const client = getXRPLClient();
  const tx: CheckCancel = await client.autofill({
    TransactionType: 'CheckCancel',
    Account: wallet.address,
    CheckID: checkId,
  });
  await submitTransaction(client, tx, wallet);
}

export async function cashCheckExpectFailure(
  receiver: Wallet,
  checkId: string,
  amount: string,
  issuer: Wallet,
  expectedResult: string,
  currency = CURRENCY
): Promise<void> {
  const client = getXRPLClient();
  const tx: CheckCash = await client.autofill({
    TransactionType: 'CheckCash',
    Account: receiver.address,
    CheckID: checkId,
    Amount: {
      currency: currencyToHex(currency),
      issuer: issuer.address,
      value: amount,
    },
  });
  await submitTransaction(client, tx, receiver, expectedResult);
}

// ─── Balance Query Operations ───────────────────────────────────────────────

export async function getXRPBalance(wallet: Wallet): Promise<bigint> {
  const client = getXRPLClient();
  const accountInfo = await client.request({
    command: 'account_info',
    account: wallet.address,
    ledger_index: 'validated',
  });
  return BigInt(accountInfo.result.account_data.Balance);
}
