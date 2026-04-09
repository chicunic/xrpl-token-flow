import {
  authorizeMPToken,
  createMPTokenIssuance,
  getMPTokenBalance,
  lockMPToken,
  mintMPToken,
  transferMPToken,
  unlockMPToken,
} from '@tests/utils/multi-purpose-token.helper';
import { setupWallets } from '@tests/utils/test.helper';
import type { Client, Wallet } from 'xrpl';
import { getXRPLClient, initializeXRPLClient } from '@/config/xrpl.config';

/**
 * MPToken Lock/Unlock Test
 *
 * Tests individual and global lock (freeze) operations:
 *   Phase 1: Setup issuance with tfMPTCanLock
 *   Phase 2: Individual lock — locked holder cannot send or receive
 *   Phase 3: Individual unlock — transfers resume
 *   Phase 4: Global lock — all peer transfers blocked
 *   Phase 5: Issuer can still mint during global lock
 *   Phase 6: Global unlock — transfers resume
 */
describe('Multi-Purpose Token Lock/Unlock', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  let mptIssuanceId: string;

  beforeAll(async () => {
    console.log('🚀 Starting MPToken Lock/Unlock Test');

    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Setup', () => {
    it('should create wallets, issuance, and mint tokens', async () => {
      console.log('\n==================== PHASE 1: SETUP ====================');

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      mptIssuanceId = await createMPTokenIssuance(issuerWallet);

      await authorizeMPToken(aliceWallet, mptIssuanceId);
      await authorizeMPToken(bobWallet, mptIssuanceId);
      await mintMPToken(issuerWallet, aliceWallet, mptIssuanceId, '5000');
      await mintMPToken(issuerWallet, bobWallet, mptIssuanceId, '5000');

      console.log(`✅ Setup complete. Alice: 5000, Bob: 5000`);
    }, 80000);
  });

  describe('Phase 2: Individual Lock', () => {
    it('should lock Alice individually', async () => {
      console.log('\n==================== PHASE 2: INDIVIDUAL LOCK ====================');

      await lockMPToken(issuerWallet, mptIssuanceId, aliceWallet);

      console.log('✅ Alice individually locked');
    }, 20000);

    it('should fail transfer FROM locked Alice', async () => {
      await transferMPToken(aliceWallet, bobWallet, mptIssuanceId, '100', 'tecLOCKED');

      console.log('✅ Transfer from locked Alice failed: tecLOCKED');
    }, 20000);

    it('should fail transfer TO locked Alice', async () => {
      await transferMPToken(bobWallet, aliceWallet, mptIssuanceId, '100', 'tecLOCKED');

      console.log('✅ Transfer to locked Alice failed: tecLOCKED');
    }, 20000);

    it('should allow issuer to mint to locked Alice', async () => {
      const aliceBefore = BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId));

      await mintMPToken(issuerWallet, aliceWallet, mptIssuanceId, '100');

      expect(BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId))).toBe(aliceBefore + 100n);

      console.log('✅ Issuer can mint to locked Alice');
    }, 20000);
  });

  describe('Phase 3: Individual Unlock', () => {
    it('should unlock Alice and resume transfers', async () => {
      console.log('\n==================== PHASE 3: INDIVIDUAL UNLOCK ====================');

      await unlockMPToken(issuerWallet, mptIssuanceId, aliceWallet);

      const aliceBefore = BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId));
      const bobBefore = BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId));

      await transferMPToken(aliceWallet, bobWallet, mptIssuanceId, '100');

      expect(BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId))).toBe(aliceBefore - 100n);
      expect(BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId))).toBe(bobBefore + 100n);

      console.log('✅ Alice unlocked, transfer succeeded');
    }, 30000);
  });

  describe('Phase 4: Global Lock', () => {
    it('should global lock all holders', async () => {
      console.log('\n==================== PHASE 4: GLOBAL LOCK ====================');

      await lockMPToken(issuerWallet, mptIssuanceId);

      console.log('✅ Global lock enabled');
    }, 20000);

    it('should fail Alice → Bob transfer during global lock', async () => {
      await transferMPToken(aliceWallet, bobWallet, mptIssuanceId, '100', 'tecLOCKED');

      console.log('✅ Alice → Bob failed during global lock: tecLOCKED');
    }, 20000);

    it('should fail Bob → Alice transfer during global lock', async () => {
      await transferMPToken(bobWallet, aliceWallet, mptIssuanceId, '100', 'tecLOCKED');

      console.log('✅ Bob → Alice failed during global lock: tecLOCKED');
    }, 20000);
  });

  describe('Phase 5: Issuer Operations During Global Lock', () => {
    it('should allow issuer to mint during global lock', async () => {
      console.log('\n==================== PHASE 5: ISSUER OPS DURING LOCK ====================');

      const bobBefore = BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId));

      await mintMPToken(issuerWallet, bobWallet, mptIssuanceId, '200');

      expect(BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId))).toBe(bobBefore + 200n);

      console.log('✅ Issuer can mint during global lock');
    }, 20000);
  });

  describe('Phase 6: Global Unlock', () => {
    it('should global unlock and resume all transfers', async () => {
      console.log('\n==================== PHASE 6: GLOBAL UNLOCK ====================');

      await unlockMPToken(issuerWallet, mptIssuanceId);

      const aliceBefore = BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId));
      const bobBefore = BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId));

      await transferMPToken(aliceWallet, bobWallet, mptIssuanceId, '100');

      expect(BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId))).toBe(aliceBefore - 100n);
      expect(BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId))).toBe(bobBefore + 100n);

      console.log('✅ Global unlock, transfers resumed');
    }, 30000);
  });
});
