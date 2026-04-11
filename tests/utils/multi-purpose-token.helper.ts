import type {
  Clawback,
  MPTokenAuthorize,
  MPTokenIssuanceCreate,
  MPTokenIssuanceDestroy,
  MPTokenIssuanceSet,
  Payment,
  TransactionMetadata,
  Wallet,
} from 'xrpl';
import { encodeMPTokenMetadata, MPTokenIssuanceCreateFlags } from 'xrpl';
import type { MPToken } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient } from '@/config/xrpl.config';
import { submitTransaction } from './test.helper';

export const MPT_METADATA = {
  ticker: 'TUSD',
  name: 'Test USD Token',
  desc: 'A test token for integration testing',
  icon: 'https://example.com/tusd-icon.png',
  asset_class: 'rwa',
  asset_subclass: 'stablecoin',
  issuer_name: 'Test Issuer',
};

export const DEFAULT_MPT_FLAGS =
  MPTokenIssuanceCreateFlags.tfMPTCanTransfer |
  MPTokenIssuanceCreateFlags.tfMPTCanLock |
  MPTokenIssuanceCreateFlags.tfMPTCanClawback;

export async function createMPTokenIssuance(
  issuer: Wallet,
  flags: number = DEFAULT_MPT_FLAGS,
  options: {
    assetScale?: number;
    maxAmount?: string;
    transferFee?: number;
  } = {}
): Promise<string> {
  const client = getXRPLClient();
  const metadata = encodeMPTokenMetadata(MPT_METADATA);

  const createTx: MPTokenIssuanceCreate = await client.autofill({
    TransactionType: 'MPTokenIssuanceCreate',
    Account: issuer.address,
    AssetScale: options.assetScale ?? 2,
    MaximumAmount: options.maxAmount ?? '100000000',
    TransferFee: options.transferFee ?? 0,
    Flags: flags,
    MPTokenMetadata: metadata,
  });

  const signed = issuer.sign(createTx);
  const result = await client.submitAndWait(signed.tx_blob);
  const meta = result.result.meta as TransactionMetadata & { mpt_issuance_id?: string };
  expect(meta.TransactionResult).toBe('tesSUCCESS');
  expect(meta.mpt_issuance_id).toBeDefined();

  return meta.mpt_issuance_id!;
}

export async function authorizeMPToken(holder: Wallet, mptIssuanceId: string): Promise<void> {
  const client = getXRPLClient();
  const authTx: MPTokenAuthorize = await client.autofill({
    TransactionType: 'MPTokenAuthorize',
    Account: holder.address,
    MPTokenIssuanceID: mptIssuanceId,
  });
  await submitTransaction(client, authTx, holder);
}

export async function issuerAuthorizeMPToken(issuer: Wallet, holder: Wallet, mptIssuanceId: string): Promise<void> {
  const client = getXRPLClient();
  const authTx: MPTokenAuthorize = await client.autofill({
    TransactionType: 'MPTokenAuthorize',
    Account: issuer.address,
    MPTokenIssuanceID: mptIssuanceId,
    Holder: holder.address,
  });
  await submitTransaction(client, authTx, issuer);
}

export async function unauthorizeMPToken(holder: Wallet, mptIssuanceId: string): Promise<void> {
  const client = getXRPLClient();
  const unauthTx: MPTokenAuthorize = await client.autofill({
    TransactionType: 'MPTokenAuthorize',
    Account: holder.address,
    MPTokenIssuanceID: mptIssuanceId,
    Flags: { tfMPTUnauthorize: true },
  });
  await submitTransaction(client, unauthTx, holder);
}

export async function mintMPToken(issuer: Wallet, dest: Wallet, mptIssuanceId: string, amount: string): Promise<void> {
  const client = getXRPLClient();
  const mintTx: Payment = await client.autofill({
    TransactionType: 'Payment',
    Account: issuer.address,
    Destination: dest.address,
    Amount: {
      mpt_issuance_id: mptIssuanceId,
      value: amount,
    },
  });
  await submitTransaction(client, mintTx, issuer);
}

export async function transferMPToken(
  sender: Wallet,
  dest: Wallet,
  mptIssuanceId: string,
  amount: string,
  expectedResult = 'tesSUCCESS',
  sendMax?: string
): Promise<void> {
  const client = getXRPLClient();
  const transferTx: Payment = await client.autofill({
    TransactionType: 'Payment',
    Account: sender.address,
    Destination: dest.address,
    Amount: {
      mpt_issuance_id: mptIssuanceId,
      value: amount,
    },
    ...(sendMax ? { SendMax: { mpt_issuance_id: mptIssuanceId, value: sendMax } } : {}),
  });
  await submitTransaction(client, transferTx, sender, expectedResult);
}

export async function clawbackMPToken(
  issuer: Wallet,
  holder: Wallet,
  mptIssuanceId: string,
  amount: string
): Promise<void> {
  const client = getXRPLClient();
  const clawbackTx: Clawback = await client.autofill({
    TransactionType: 'Clawback',
    Account: issuer.address,
    Amount: {
      mpt_issuance_id: mptIssuanceId,
      value: amount,
    },
    Holder: holder.address,
  });
  await submitTransaction(client, clawbackTx, issuer);
}

export async function lockMPToken(issuer: Wallet, mptIssuanceId: string, holder?: Wallet): Promise<void> {
  const client = getXRPLClient();
  const lockTx: MPTokenIssuanceSet = await client.autofill({
    TransactionType: 'MPTokenIssuanceSet',
    Account: issuer.address,
    MPTokenIssuanceID: mptIssuanceId,
    ...(holder ? { Holder: holder.address } : {}),
    Flags: { tfMPTLock: true },
  });
  await submitTransaction(client, lockTx, issuer);
}

export async function unlockMPToken(issuer: Wallet, mptIssuanceId: string, holder?: Wallet): Promise<void> {
  const client = getXRPLClient();
  const unlockTx: MPTokenIssuanceSet = await client.autofill({
    TransactionType: 'MPTokenIssuanceSet',
    Account: issuer.address,
    MPTokenIssuanceID: mptIssuanceId,
    ...(holder ? { Holder: holder.address } : {}),
    Flags: { tfMPTUnlock: true },
  });
  await submitTransaction(client, unlockTx, issuer);
}

export async function destroyMPTokenIssuance(
  issuer: Wallet,
  mptIssuanceId: string,
  expectedResult = 'tesSUCCESS'
): Promise<void> {
  const client = getXRPLClient();
  const destroyTx: MPTokenIssuanceDestroy = await client.autofill({
    TransactionType: 'MPTokenIssuanceDestroy',
    Account: issuer.address,
    MPTokenIssuanceID: mptIssuanceId,
  });
  await submitTransaction(client, destroyTx, issuer, expectedResult);
}

export async function getMPTokenBalance(holder: Wallet, mptIssuanceId: string): Promise<string> {
  const client = getXRPLClient();
  const accountObjects = await client.request({
    command: 'account_objects',
    account: holder.address,
    type: 'mptoken',
  });
  // SDK types don't include MPToken in AccountObject union — cast needed
  const objects = accountObjects.result.account_objects as unknown as MPToken[];
  const mpt = objects.find(obj => obj.MPTokenIssuanceID === mptIssuanceId);
  return (mpt?.MPTAmount as unknown as string) ?? '0';
}
