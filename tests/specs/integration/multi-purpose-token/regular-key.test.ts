import { setupWallets } from "@tests/utils/test.helper.js";
import { assignRegularKey, disableMasterKey } from "@/services/regular-key.service.js";
import { submitTransaction } from "@/services/transaction.service.js";
import {
  DEFAULT_MPT_FLAGS,
  MPT_METADATA,
  authorizeMPToken,
  getMPTokenBalance,
} from "@/services/multi-purpose-token.service.js";
import type { Client, MPTokenIssuanceCreate, Payment, Wallet } from "xrpl";
import { encodeMPTokenMetadata } from "xrpl";
import { getXRPLClient, initializeXRPLClient } from "@/config/xrpl.config.js";

/**
 * Account Security & Key Rotation (Regular Key) for MPT
 *
 * Demonstrates:
 * 1. Assigning a hot wallet as a Regular Key to an Issuer account.
 * 2. Disabling the Issuer's Master Key (Cold Storage isolation).
 * 3. Proving the Master Key can no longer issue or manage MPTs (tefMASTER_DISABLED).
 * 4. Successfully issuing and minting an MPT using the hot wallet.
 */
describe("Multi-Purpose Token - Key Rotation & Security", () => {
  let client: Client;

  let masterIssuerWallet: Wallet;
  let hotWallet: Wallet;
  let userWallet: Wallet;

  let mptIssuanceId: string;

  beforeAll(async () => {
    console.log("🚀 Starting MPT Regular Key Test");
    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  it("should setup and fund wallets", async () => {
    const wallets = await setupWallets(3);
    masterIssuerWallet = wallets[0]!;
    hotWallet = wallets[1]!;
    userWallet = wallets[2]!;

    console.log(`✅ Master Issuer: ${masterIssuerWallet.address}`);
    console.log(`✅ Hot Wallet (Regular Key): ${hotWallet.address}`);
    console.log(`✅ User: ${userWallet.address}`);
  }, 60000);

  it("should assign the hot wallet as the Regular Key and disable Master", async () => {
    await assignRegularKey(masterIssuerWallet, hotWallet.address);
    console.log(`✅ Assigned ${hotWallet.address} as Regular Key`);

    await disableMasterKey(masterIssuerWallet);
    console.log("✅ Master Key disabled");
  }, 60000);

  it("should FAIL to create an MPT using the disabled Master Key", async () => {
    const createTx: MPTokenIssuanceCreate = await client.autofill({
      TransactionType: "MPTokenIssuanceCreate",
      Account: masterIssuerWallet.address,
      AssetScale: 2,
      MaximumAmount: "100000000",
      Flags: DEFAULT_MPT_FLAGS,
      MPTokenMetadata: encodeMPTokenMetadata(MPT_METADATA),
    });

    try {
      await submitTransaction(client, createTx, masterIssuerWallet);
      throw new Error("Expected transaction to fail, but it succeeded!");
    } catch (error: any) {
      expect(error.message).toContain("tefMASTER_DISABLED");
      console.log("✅ Master Key successfully blocked from MPT creation");
    }
  }, 30000);

  it("should SUCCESSFULLY create an MPT using the Regular Key", async () => {
    const createTx: MPTokenIssuanceCreate = await client.autofill({
      TransactionType: "MPTokenIssuanceCreate",
      Account: masterIssuerWallet.address, // Action by Issuer
      AssetScale: 2,
      MaximumAmount: "100000000",
      Flags: DEFAULT_MPT_FLAGS,
      MPTokenMetadata: encodeMPTokenMetadata(MPT_METADATA),
    });

    // Sign with hot wallet
    const meta = await submitTransaction(client, createTx, hotWallet);
    mptIssuanceId = (meta as unknown as { mpt_issuance_id: string }).mpt_issuance_id;

    expect(mptIssuanceId).toBeDefined();
    console.log(`✅ Successfully created MPT ${mptIssuanceId} using the Hot Wallet`);
  }, 30000);

  it("should allow Hot Wallet to mint MPT to a user", async () => {
    // 1. User authorizes the MPT
    await authorizeMPToken(userWallet, mptIssuanceId);

    // 2. Hot wallet mints
    const mintAmount = "5000";
    const mintTx: Payment = await client.autofill({
      TransactionType: "Payment",
      Account: masterIssuerWallet.address, // Action by Issuer
      Destination: userWallet.address,
      Amount: {
        mpt_issuance_id: mptIssuanceId,
        value: mintAmount,
      },
    });

    await submitTransaction(client, mintTx, hotWallet);

    const balance = await getMPTokenBalance(userWallet, mptIssuanceId);
    expect(balance).toBe(mintAmount);

    console.log(`✅ Successfully minted ${mintAmount} MPT using the Hot Wallet`);
  }, 30000);
});
