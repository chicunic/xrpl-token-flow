import {
  authorizeMPToken,
  createMPTokenIssuance,
  destroyMPTokenIssuance,
  getMPTokenBalance,
  mintMPToken,
  transferMPToken,
  unauthorizeMPToken,
} from '@tests/utils/multi-purpose-token.helper';
import { setupWallets } from '@tests/utils/test.helper';
import type { Client, Wallet } from 'xrpl';
import { getXRPLClient, initializeXRPLClient } from '@/config/xrpl.config';

/**
 * MPToken Basic Lifecycle
 *
 * Tests the fundamental MPToken operations:
 *   Phase 1: Create issuance with metadata
 *   Phase 2: Holder authorization (opt-in)
 *   Phase 3: Mint (issuer → holder)
 *   Phase 4: Peer-to-peer transfer
 *   Phase 5: Burn (holder → issuer)
 *   Phase 6: Unauthorize and destroy issuance
 */
describe('Multi-Purpose Token Basic Lifecycle', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  let mptIssuanceId: string;

  const MINT_AMOUNT = '10000';
  const TRANSFER_AMOUNT = '500';

  beforeAll(async () => {
    console.log('🚀 Starting MPToken Basic Lifecycle Test');

    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Create MPToken Issuance', () => {
    it('should create and fund all wallets', async () => {
      console.log('\n==================== PHASE 1: CREATE MPTOKEN ISSUANCE ====================');

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 60000);

    it('should create MPToken issuance with metadata', async () => {
      mptIssuanceId = await createMPTokenIssuance(issuerWallet);
      console.log(`✅ MPToken issuance created: ${mptIssuanceId}`);
    }, 30000);
  });

  describe('Phase 2: Holder Authorization', () => {
    it('should authorize Alice and Bob to hold MPToken', async () => {
      console.log('\n==================== PHASE 2: HOLDER AUTHORIZATION ====================');

      await authorizeMPToken(aliceWallet, mptIssuanceId);
      await authorizeMPToken(bobWallet, mptIssuanceId);

      console.log('✅ Alice and Bob authorized');
    }, 30000);
  });

  describe('Phase 3: Mint Tokens', () => {
    it('should mint MPTokens from issuer to Alice', async () => {
      console.log('\n==================== PHASE 3: MINT TOKENS ====================');

      await mintMPToken(issuerWallet, aliceWallet, mptIssuanceId, MINT_AMOUNT);

      expect(await getMPTokenBalance(aliceWallet, mptIssuanceId)).toBe(MINT_AMOUNT);
      console.log(`✅ Minted ${MINT_AMOUNT} MPTokens to Alice`);
    }, 30000);
  });

  describe('Phase 4: Peer-to-Peer Transfer', () => {
    it('should transfer MPTokens from Alice to Bob', async () => {
      console.log('\n==================== PHASE 4: PEER-TO-PEER TRANSFER ====================');

      const aliceBefore = BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId));
      const bobBefore = BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId));

      await transferMPToken(aliceWallet, bobWallet, mptIssuanceId, TRANSFER_AMOUNT);

      expect(BigInt(await getMPTokenBalance(aliceWallet, mptIssuanceId))).toBe(aliceBefore - BigInt(TRANSFER_AMOUNT));
      expect(BigInt(await getMPTokenBalance(bobWallet, mptIssuanceId))).toBe(bobBefore + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Alice transferred ${TRANSFER_AMOUNT} MPTokens to Bob`);
    }, 30000);
  });

  describe('Phase 5: Burn Tokens', () => {
    it('should burn tokens by transferring back to issuer', async () => {
      console.log('\n==================== PHASE 5: BURN TOKENS ====================');

      const aliceBalance = await getMPTokenBalance(aliceWallet, mptIssuanceId);
      const bobBalance = await getMPTokenBalance(bobWallet, mptIssuanceId);

      await transferMPToken(aliceWallet, issuerWallet, mptIssuanceId, aliceBalance);
      await transferMPToken(bobWallet, issuerWallet, mptIssuanceId, bobBalance);

      expect(await getMPTokenBalance(aliceWallet, mptIssuanceId)).toBe('0');
      expect(await getMPTokenBalance(bobWallet, mptIssuanceId)).toBe('0');

      console.log('✅ All tokens burned');
    }, 30000);
  });

  describe('Phase 6: Unauthorize and Destroy', () => {
    it('should unauthorize holders and destroy issuance', async () => {
      console.log('\n==================== PHASE 6: UNAUTHORIZE AND DESTROY ====================');

      await unauthorizeMPToken(aliceWallet, mptIssuanceId);
      await unauthorizeMPToken(bobWallet, mptIssuanceId);
      await destroyMPTokenIssuance(issuerWallet, mptIssuanceId);

      console.log('✅ Holders unauthorized, issuance destroyed');
    }, 40000);
  });
});
