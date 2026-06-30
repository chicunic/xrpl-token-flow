import {
  type Client,
  type SubmittableTransaction,
  type TransactionMetadata,
  type Wallet,
  convertStringToHex,
} from "xrpl";

export function currencyToHex(currency: string): string {
  if (currency.length === 3) {
    return currency;
  }
  return convertStringToHex(currency).padEnd(40, "0");
}

export async function submitTransaction(
  client: Client,
  tx: SubmittableTransaction,
  signer: Wallet,
  expectedResult = "tesSUCCESS",
): Promise<TransactionMetadata> {
  const signed = signer.sign(tx);
  const result = await client.submitAndWait(signed.tx_blob);
  const meta = result.result.meta as TransactionMetadata;
  if (meta.TransactionResult !== expectedResult) {
    throw new Error(`Transaction failed: expected ${expectedResult}, got ${meta.TransactionResult}`);
  }
  return meta;
}

export async function getAccountFlags(client: Client, address: string): Promise<bigint> {
  const accountInfo = await client.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
  });
  return BigInt(accountInfo.result.account_data.Flags || 0);
}

export function hasFlag(flags: bigint, flag: number): boolean {
  return (flags & BigInt(flag)) === BigInt(flag);
}
