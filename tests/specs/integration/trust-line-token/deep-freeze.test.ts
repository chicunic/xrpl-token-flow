import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT } from "@tests/utils/data.js";
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
  clearDeepFreezeTrustLine,
  deepFreezeTrustLine,
  freezeTrustLine,
  transferTokens,
  unfreezeTrustLine,
} from "@/services/trustline-token.service.js";
import type { Actor } from "@tests/utils/kb-runtime.js";
import type { Client, Wallet } from "xrpl";

/**
 * Trust Line Token Deep Freeze (XLS-77)
 *
 * Deep freeze extends individual freeze: a deep-frozen holder can neither
 * send nor receive the token, while a regular freeze only blocks sending.
 *   Phase 1: Deep freeze requires a regular freeze first
 *   Phase 2: Freeze + deep freeze Alice
 *   Phase 3: Deep-frozen holder cannot send or receive
 *   Phase 4: Regular freeze cannot be cleared while deep-frozen
 *   Phase 5: Clear deep freeze — receiving works again, sending still frozen
 *   Phase 6: Clear freeze — all flows restored
 */
describe("Trust Line Token Deep Freeze", () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  // Preconditions are read off the ledger at assertion time, so each fact reports the trust line
  // state accumulated by earlier phases without restating it here.
  const actors = (): Actor[] => [
    { role: "issuer", wallet: issuerWallet },
    { role: "alice", wallet: aliceWallet, trustLineWith: "issuer" },
    { role: "bob", wallet: bobWallet, trustLineWith: "issuer" },
  ];

  beforeAll(async () => {
    client = await connectClient("Trust Line Token Deep Freeze Test");
    [issuerWallet, aliceWallet, bobWallet] = await setupWallets(3);

    await setupIssuerWithFlags(issuerWallet);
    await createTrustLine(aliceWallet, issuerWallet);
    await createTrustLine(bobWallet, issuerWallet);
    await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);
    await mintTokens(issuerWallet, bobWallet, MINT_AMOUNT);
  }, 120000);

  afterAll(async () => {
    await disconnectClient(client);
  });

  describe("Phase 1: Deep Freeze Preconditions", () => {
    it("should fail to deep freeze a trust line that is not frozen", async () => {
      console.log("\n==================== PHASE 1: DEEP FREEZE PRECONDITIONS ====================");

      await expectTxFail("tecNO_PERMISSION", () => deepFreezeTrustLine(issuerWallet, aliceWallet), {
        when: { en: "Deep freeze without regular freeze", zh: "未普通冻结时直接深度冻结" },
        actors: actors(),
        // The absence of a freeze is the point here, and absent state has no ledger flag to report.
        givenExtra: [{ en: "Trust line not frozen", zh: "信任线未冻结", source: "manual" }],
      });

      console.log("✅ Deep freeze without regular freeze failed: tecNO_PERMISSION");
    }, 30000);
  });

  describe("Phase 2: Apply Freeze + Deep Freeze", () => {
    it("should deep freeze after a regular freeze", async () => {
      console.log("\n==================== PHASE 2: APPLY FREEZE + DEEP FREEZE ====================");

      await freezeTrustLine(issuerWallet, aliceWallet);
      await deepFreezeTrustLine(issuerWallet, aliceWallet);

      console.log("✅ Alice's trust line is frozen and deep-frozen");
    }, 30000);
  });

  describe("Phase 3: Deep-Frozen Transfers", () => {
    it("should block the deep-frozen holder from sending", async () => {
      console.log("\n==================== PHASE 3: DEEP-FROZEN TRANSFERS ====================");

      await expectTxFail("tecPATH_DRY", () => transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet), {
        when: { en: "Deep-frozen holder sends", zh: "深度冻结的持有者发送" },
        actors: actors(),
      });

      console.log("✅ Deep-frozen Alice cannot send");
    }, 30000);

    it("should block the deep-frozen holder from receiving", async () => {
      await expectTxFail("tecPATH_DRY", () => transferTokens(bobWallet, aliceWallet, TRANSFER_AMOUNT, issuerWallet), {
        when: { en: "Deep-frozen holder receives", zh: "深度冻结的持有者接收" },
        actors: actors(),
      });

      console.log("✅ Deep-frozen Alice cannot receive");
    }, 30000);
  });

  describe("Phase 4: Clear Order Enforcement", () => {
    it("should fail to clear the regular freeze while deep-frozen", async () => {
      console.log("\n==================== PHASE 4: CLEAR ORDER ENFORCEMENT ====================");

      await expectTxFail("tecNO_PERMISSION", () => unfreezeTrustLine(issuerWallet, aliceWallet), {
        when: { en: "Clear regular freeze while deep-frozen", zh: "深度冻结未清除时清除冻结" },
        actors: actors(),
        // The ledger shows both freezes, but it is the deep freeze that blocks the clear.
        givenOverride: [{ en: "Deep freeze still set", zh: "深度冻结仍生效", source: "manual" }],
      });

      console.log("✅ Regular freeze cannot be cleared while deep freeze is set");
    }, 30000);
  });

  describe("Phase 5: Clear Deep Freeze Only", () => {
    it("should allow receiving after deep freeze is cleared, sending still frozen", async () => {
      console.log("\n==================== PHASE 5: CLEAR DEEP FREEZE ====================");

      await clearDeepFreezeTrustLine(issuerWallet, aliceWallet);

      const aliceBefore = BigInt(await getTokenBalance(aliceWallet, issuerWallet));
      await factSucceeds(
        {
          when: { en: "Receive after deep freeze cleared", zh: "清除深度冻结后接收" },
          actors: actors(),
        },
        () => transferTokens(bobWallet, aliceWallet, TRANSFER_AMOUNT, issuerWallet),
      );
      expect(BigInt(await getTokenBalance(aliceWallet, issuerWallet))).toBe(aliceBefore + BigInt(TRANSFER_AMOUNT));

      await expectTxFail("tecPATH_DRY", () => transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet), {
        when: { en: "Send after deep freeze cleared", zh: "清除深度冻结后发送" },
        actors: actors(),
      });

      console.log(`✅ Alice received ${TRANSFER_AMOUNT} ${CURRENCY} but still cannot send (regular freeze)`);
    }, 30000);
  });

  describe("Phase 6: Clear Freeze", () => {
    it("should restore both directions after the freeze is cleared", async () => {
      console.log("\n==================== PHASE 6: CLEAR FREEZE ====================");

      await unfreezeTrustLine(issuerWallet, aliceWallet);

      const bobBefore = BigInt(await getTokenBalance(bobWallet, issuerWallet));
      await factSucceeds(
        {
          when: { en: "Send after freeze cleared", zh: "解除冻结后发送" },
          actors: actors(),
          // Both freezes are gone; a cleared flag leaves nothing on the ledger to observe.
          givenExtra: [{ en: "All freezes cleared", zh: "所有冻结已清除", source: "manual" }],
        },
        () => transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet),
      );
      expect(BigInt(await getTokenBalance(bobWallet, issuerWallet))).toBe(bobBefore + BigInt(TRANSFER_AMOUNT));

      console.log("✅ Transfers restored in both directions");
    }, 30000);
  });
});
