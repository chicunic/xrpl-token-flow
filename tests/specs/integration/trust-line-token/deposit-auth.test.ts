import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT, XRP_TRANSFER_AMOUNT } from "@tests/utils/data.js";
import {
  connectClient,
  createTrustLine,
  disconnectClient,
  expectTxFail,
  factSucceeds,
  getTokenBalance,
  mintTokens,
  setupIssuerWithFlags,
  setupWallets,
} from "@tests/utils/test.helper.js";
import {
  clearAccountFlag,
  getXRPBalance,
  preauthorizeSender,
  revokeSenderPreauth,
  setAccountFlag,
  transferTokens,
  transferXRP,
  verifyAccountFlag,
} from "@/services/trustline-token.service.js";
import type { Actor } from "@tests/utils/kb-runtime.js";
import type { Client, Wallet } from "xrpl";
import { AccountSetAsfFlags } from "xrpl";
import { AccountRootFlags } from "xrpl/dist/npm/models/ledger/index.js";

/**
 * DepositAuth Flag Test
 *
 * Tests deposit authorization:
 *   Phase 1: Setup - Create Issuer, Alice, Bob with DefaultRipple
 *   Phase 2: Trust Lines and Token Setup
 *   Phase 3: Enable DepositAuth on Bob — incoming payments blocked
 *   Phase 4: DepositPreauth Lifecycle — preauthorize/unauthorize Alice
 *   Phase 5: Disable DepositAuth — normal payment behavior restored
 */
describe("Trust Line Token DepositAuth", () => {
  let client: Client;

  let aliceWallet: Wallet;
  let bobWallet: Wallet;
  let issuerWallet: Wallet;

  // Bob owns the DepositPreauth object, so counting his ledger objects is what distinguishes
  // "Alice preauthorized" from "Alice preauth removed" — no account flag changes between them.
  const actors = (): Actor[] => [
    { role: "issuer", wallet: issuerWallet },
    { role: "alice", wallet: aliceWallet },
    { role: "bob", wallet: bobWallet, ledgerObjects: ["DepositPreauth"] },
  ];

  beforeAll(async () => {
    client = await connectClient("DepositAuth Flag Test");
    [issuerWallet, aliceWallet, bobWallet] = await setupWallets(3);
  }, 90000);

  afterAll(async () => {
    await disconnectClient(client);
  });

  describe("Phase 1: Setup - Create Issuer and User Accounts", () => {
    it("should configure the issuer account", async () => {
      console.log("\n==================== PHASE 1: SETUP - CREATE ISSUER AND USER ACCOUNTS ====================");

      await setupIssuerWithFlags(issuerWallet);
    }, 60000);
  });

  describe("Phase 2: Trust Lines and Token Setup", () => {
    it("should create trust lines and issue tokens to Alice and Bob", async () => {
      console.log("\n==================== PHASE 2: TRUST LINES AND TOKEN SETUP ====================");

      await createTrustLine(aliceWallet, issuerWallet);
      await createTrustLine(bobWallet, issuerWallet);

      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);
      await mintTokens(issuerWallet, bobWallet, MINT_AMOUNT);

      expect(await getTokenBalance(aliceWallet, issuerWallet)).toBe(MINT_AMOUNT);
      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(MINT_AMOUNT);

      console.log(`✅ Alice now has ${MINT_AMOUNT} ${CURRENCY}`);
      console.log(`✅ Bob now has ${MINT_AMOUNT} ${CURRENCY}`);
    }, 80000);
  });

  describe("Phase 3: Enable DepositAuth on Bob", () => {
    it("should enable DepositAuth flag on Bob", async () => {
      console.log("\n==================== PHASE 3: ENABLE DEPOSITAUTH ON BOB ====================");

      await setAccountFlag(bobWallet, AccountSetAsfFlags.asfDepositAuth);

      await verifyAccountFlag(bobWallet.address, AccountRootFlags.lsfDepositAuth, true);

      console.log("✅ DepositAuth flag enabled on Bob successfully");
    }, 20000);

    it("should fail Alice -> Bob USD transfer with DepositAuth enabled", async () => {
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await expectTxFail(
        "tecNO_PERMISSION",
        () => transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet),
        { when: { en: "Alice → Bob USD", zh: "Alice → Bob USD" }, actors: actors() },
      );

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log("✅ Alice -> Bob USD transfer correctly failed with DepositAuth");
    }, 30000);

    it("should fail Alice -> Bob XRP transfer with DepositAuth enabled", async () => {
      const bobXrpBalanceBefore = await getXRPBalance(bobWallet);

      await expectTxFail("tecNO_PERMISSION", () => transferXRP(aliceWallet, bobWallet, XRP_TRANSFER_AMOUNT), {
        when: { en: "Alice → Bob XRP", zh: "Alice → Bob XRP" },
        actors: actors(),
      });

      const bobXrpBalanceAfter = await getXRPBalance(bobWallet);
      expect(bobXrpBalanceAfter).toEqual(bobXrpBalanceBefore);

      console.log("✅ Alice -> Bob XRP transfer correctly failed with DepositAuth");
    }, 30000);

    it("should fail Issuer -> Bob USD mint with DepositAuth enabled", async () => {
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await expectTxFail("tecNO_PERMISSION", () => transferTokens(issuerWallet, bobWallet, MINT_AMOUNT, issuerWallet), {
        when: { en: "Issuer → Bob USD (mint)", zh: "Issuer → Bob USD (mint)" },
        actors: actors(),
      });

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log("✅ Issuer -> Bob USD mint correctly failed with DepositAuth");
    }, 30000);

    it("should succeed Bob -> Alice USD transfer with DepositAuth enabled", async () => {
      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      await factSucceeds(
        {
          when: { en: "Bob → Alice USD", zh: "Bob → Alice USD" },
          actors: actors(),
          note: { en: "outgoing unrestricted", zh: "出账不受限" },
        },
        () => transferTokens(bobWallet, aliceWallet, TRANSFER_AMOUNT, issuerWallet),
      );

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(BigInt(aliceBalanceAfter)).toEqual(BigInt(aliceBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Bob -> Alice USD transfer successful (${TRANSFER_AMOUNT} ${CURRENCY})`);
    }, 30000);

    it("should succeed Bob -> Alice XRP transfer with DepositAuth enabled", async () => {
      const aliceXrpBalanceBefore = await getXRPBalance(aliceWallet);

      await factSucceeds(
        {
          when: { en: "Bob → Alice XRP", zh: "Bob → Alice XRP" },
          actors: actors(),
          note: { en: "outgoing unrestricted", zh: "出账不受限" },
        },
        () => transferXRP(bobWallet, aliceWallet, XRP_TRANSFER_AMOUNT),
      );

      const aliceXrpBalanceAfter = await getXRPBalance(aliceWallet);
      expect(aliceXrpBalanceAfter).toBeGreaterThan(aliceXrpBalanceBefore);

      console.log(`✅ Bob -> Alice XRP transfer successful (${XRP_TRANSFER_AMOUNT} XRP)`);
    }, 30000);
  });

  describe("Phase 4: DepositPreauth", () => {
    it("should preauthorize Alice to send to Bob", async () => {
      console.log("\n==================== PHASE 4: DEPOSITPREAUTH ====================");

      await preauthorizeSender(bobWallet, aliceWallet);

      console.log("✅ Bob has preauthorized Alice to send deposits");
    }, 10000);

    it("should succeed Alice -> Bob USD transfer after preauthorization", async () => {
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await factSucceeds({ when: { en: "Alice → Bob USD", zh: "Alice → Bob USD" }, actors: actors() }, () =>
        transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet),
      );

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Alice -> Bob USD transfer successful after preauthorization (${TRANSFER_AMOUNT} ${CURRENCY})`);
    }, 30000);

    it("should succeed Alice -> Bob XRP transfer after preauthorization", async () => {
      const bobXrpBalanceBefore = await getXRPBalance(bobWallet);

      await factSucceeds({ when: { en: "Alice → Bob XRP", zh: "Alice → Bob XRP" }, actors: actors() }, () =>
        transferXRP(aliceWallet, bobWallet, XRP_TRANSFER_AMOUNT),
      );

      const bobXrpBalanceAfter = await getXRPBalance(bobWallet);
      expect(bobXrpBalanceAfter).toBeGreaterThan(bobXrpBalanceBefore);

      console.log(`✅ Alice -> Bob XRP transfer successful after preauthorization (${XRP_TRANSFER_AMOUNT} XRP)`);
    }, 30000);

    it("should unauthorize Alice (remove preauthorization)", async () => {
      await revokeSenderPreauth(bobWallet, aliceWallet);

      console.log("✅ Bob has removed preauthorization for Alice");
    }, 10000);

    it("should fail Alice -> Bob USD transfer after removing preauthorization", async () => {
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await expectTxFail(
        "tecNO_PERMISSION",
        () => transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet),
        {
          when: { en: "Alice → Bob USD", zh: "Alice → Bob USD" },
          actors: actors(),
          // A revoked DepositPreauth leaves no object behind, so it reads identically to one that
          // was never granted; only the test knows which state this is.
          givenExtra: [
            { en: "Alice preauth removed", zh: "Alice 预授权已移除", source: "manual", axis: "bob.DepositPreauth" },
          ],
        },
      );

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log("✅ Alice -> Bob USD transfer correctly failed after removing preauthorization");
    }, 30000);

    it("should fail Alice -> Bob XRP transfer after removing preauthorization", async () => {
      const bobXrpBalanceBefore = await getXRPBalance(bobWallet);

      await expectTxFail("tecNO_PERMISSION", () => transferXRP(aliceWallet, bobWallet, XRP_TRANSFER_AMOUNT), {
        when: { en: "Alice → Bob XRP", zh: "Alice → Bob XRP" },
        actors: actors(),
        givenExtra: [
          { en: "Alice preauth removed", zh: "Alice 预授权已移除", source: "manual", axis: "bob.DepositPreauth" },
        ],
      });

      const bobXrpBalanceAfter = await getXRPBalance(bobWallet);
      expect(bobXrpBalanceAfter).toEqual(bobXrpBalanceBefore);

      console.log("✅ Alice -> Bob XRP transfer correctly failed after removing preauthorization");
    }, 30000);
  });

  describe("Phase 5: Disable DepositAuth", () => {
    it("should disable DepositAuth flag on Bob", async () => {
      console.log("\n==================== PHASE 5: DISABLE DEPOSITAUTH ====================");

      await clearAccountFlag(bobWallet, AccountSetAsfFlags.asfDepositAuth);

      await verifyAccountFlag(bobWallet.address, AccountRootFlags.lsfDepositAuth, false);

      console.log("✅ DepositAuth flag disabled on Bob successfully");
    }, 20000);

    it("should succeed Alice -> Bob transfer after disabling DepositAuth", async () => {
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await factSucceeds(
        {
          when: { en: "Alice → Bob USD", zh: "Alice → Bob USD" },
          actors: actors(),
          // DepositAuth is off, so preauthorization no longer applies at all.
          givenExtra: [{ en: "-", zh: "-", source: "manual", axis: "bob.DepositPreauth" }],
        },
        () => transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet),
      );

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Transfer successful after disabling DepositAuth: Alice -> Bob (${TRANSFER_AMOUNT} ${CURRENCY})`);
    }, 30000);

    it("should succeed Alice -> Bob XRP transfer after disabling DepositAuth", async () => {
      const bobXrpBalanceBefore = await getXRPBalance(bobWallet);

      await factSucceeds(
        {
          when: { en: "Alice → Bob XRP", zh: "Alice → Bob XRP" },
          actors: actors(),
          // DepositAuth is off, so preauthorization no longer applies at all.
          givenExtra: [{ en: "-", zh: "-", source: "manual", axis: "bob.DepositPreauth" }],
        },
        () => transferXRP(aliceWallet, bobWallet, XRP_TRANSFER_AMOUNT),
      );

      const bobXrpBalanceAfter = await getXRPBalance(bobWallet);
      expect(bobXrpBalanceAfter).toBeGreaterThan(bobXrpBalanceBefore);

      console.log(`✅ Alice -> Bob XRP transfer successful after disabling DepositAuth (${XRP_TRANSFER_AMOUNT} XRP)`);
    }, 30000);
  });
});
