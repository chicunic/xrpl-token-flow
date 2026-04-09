import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT } from '@tests/utils/data';
import {
  createTrustLine,
  getTokenBalance,
  mintTokens,
  setupIssuerWithFlags,
  setupWallets,
} from '@tests/utils/test.helper';
import {
  clearAccountFlag,
  setAccountFlag,
  transferTokens,
  verifyAccountFlag,
} from '@tests/utils/trust-line-token.helper';
import type { Client, Wallet } from 'xrpl';
import { AccountSetAsfFlags } from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';
import { getXRPLClient, initializeXRPLClient } from '@/config/xrpl.config';

describe('Trust Line Token GlobalFreeze', () => {
  let client: Client;

  let aliceWallet: Wallet;
  let bobWallet: Wallet;
  let issuerWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting GlobalFreeze Flag Test');

    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Setup - Create Issuer and User Accounts', () => {
    it('should create and fund all wallets with issuer configured', async () => {
      console.log('\n==================== PHASE 1: SETUP - CREATE ISSUER AND USER ACCOUNTS ====================');

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      await setupIssuerWithFlags(issuerWallet);

      await verifyAccountFlag(issuerWallet.address, AccountRootFlags.lsfGlobalFreeze, false);

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
      console.log('✅ Issuer setup complete WITHOUT GlobalFreeze flag');
    }, 80000);
  });

  describe('Phase 2: Normal Operations (Before GlobalFreeze)', () => {
    it('should create trust lines and issue tokens to Alice and Bob', async () => {
      console.log('\n==================== PHASE 2: NORMAL OPERATIONS (BEFORE GLOBALFREEZE) ====================');

      await createTrustLine(aliceWallet, issuerWallet);
      await createTrustLine(bobWallet, issuerWallet);

      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);
      await mintTokens(issuerWallet, bobWallet, MINT_AMOUNT);

      expect(await getTokenBalance(aliceWallet, issuerWallet)).toBe(MINT_AMOUNT);
      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(MINT_AMOUNT);

      console.log(`✅ Alice has ${MINT_AMOUNT} ${CURRENCY}`);
      console.log(`✅ Bob has ${MINT_AMOUNT} ${CURRENCY}`);
    }, 80000);
  });

  describe('Phase 3: Enable GlobalFreeze', () => {
    it('should enable GlobalFreeze flag', async () => {
      console.log('\n==================== PHASE 3: ENABLE GLOBALFREEZE ====================');

      await setAccountFlag(issuerWallet, AccountSetAsfFlags.asfGlobalFreeze);
      await verifyAccountFlag(issuerWallet.address, AccountRootFlags.lsfGlobalFreeze, true);

      console.log('✅ GlobalFreeze flag enabled successfully');
    }, 20000);

    it('should fail Alice -> Bob transfer with GlobalFreeze enabled', async () => {
      console.log('🙅 Testing transfer failure with GlobalFreeze enabled...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet, 'tecPATH_DRY');

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log('✅ Transfer correctly failed with GlobalFreeze: tecPATH_DRY');
    }, 30000);

    it('should fail Bob -> Alice transfer with GlobalFreeze enabled', async () => {
      console.log('🙅 Testing reverse transfer failure with GlobalFreeze enabled...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      await transferTokens(bobWallet, aliceWallet, TRANSFER_AMOUNT, issuerWallet, 'tecPATH_DRY');

      expect(await getTokenBalance(aliceWallet, issuerWallet)).toBe(aliceBalanceBefore);

      console.log('✅ Reverse transfer correctly failed with GlobalFreeze: tecPATH_DRY');
    }, 30000);

    it('should allow issuer to mint (issue) tokens with GlobalFreeze enabled', async () => {
      console.log('💰 Testing mint operation with GlobalFreeze enabled...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(BigInt(aliceBalanceAfter)).toEqual(BigInt(aliceBalanceBefore) + BigInt(MINT_AMOUNT));

      console.log('✅ Issuer can still mint tokens with GlobalFreeze enabled');
      console.log(`✅ Alice balance increased from ${aliceBalanceBefore} to ${aliceBalanceAfter}`);
    }, 30000);

    it('should allow issuer to mint tokens to Bob with GlobalFreeze enabled', async () => {
      console.log('💰 Testing mint to Bob with GlobalFreeze enabled...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await mintTokens(issuerWallet, bobWallet, MINT_AMOUNT);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(MINT_AMOUNT));

      console.log('✅ Issuer can mint tokens to Bob with GlobalFreeze enabled');
      console.log(`✅ Bob balance increased from ${bobBalanceBefore} to ${bobBalanceAfter}`);
    }, 30000);

    it('should allow issuer to burn (redeem) tokens with GlobalFreeze enabled', async () => {
      console.log('🔥 Testing burn operation with GlobalFreeze enabled...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      await transferTokens(aliceWallet, issuerWallet, TRANSFER_AMOUNT, issuerWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(BigInt(aliceBalanceAfter)).toEqual(BigInt(aliceBalanceBefore) - BigInt(TRANSFER_AMOUNT));

      console.log('✅ Burn operation successful with GlobalFreeze enabled');
      console.log(`✅ Alice balance decreased from ${aliceBalanceBefore} to ${aliceBalanceAfter}`);
    }, 30000);

    it('should allow users to burn tokens by sending to issuer with GlobalFreeze enabled', async () => {
      console.log('🔥 Testing user-initiated burn with GlobalFreeze enabled...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await transferTokens(bobWallet, issuerWallet, TRANSFER_AMOUNT, issuerWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) - BigInt(TRANSFER_AMOUNT));

      console.log('✅ User-initiated burn successful with GlobalFreeze enabled');
      console.log(`✅ Bob balance decreased from ${bobBalanceBefore} to ${bobBalanceAfter}`);
    }, 30000);
  });

  describe('Phase 4: Disable GlobalFreeze', () => {
    it('should disable GlobalFreeze flag', async () => {
      console.log('\n==================== PHASE 4: DISABLE GLOBALFREEZE ====================');

      await clearAccountFlag(issuerWallet, AccountSetAsfFlags.asfGlobalFreeze);
      await verifyAccountFlag(issuerWallet.address, AccountRootFlags.lsfGlobalFreeze, false);

      console.log('✅ GlobalFreeze flag disabled successfully');
    }, 20000);

    it('should succeed Alice -> Bob transfer after disabling GlobalFreeze', async () => {
      console.log('✅ Testing transfer success after disabling GlobalFreeze...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      await transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Transfer successful after unfreezing: Alice -> Bob (${TRANSFER_AMOUNT} ${CURRENCY})`);
      console.log(`✅ Bob balance increased from ${bobBalanceBefore} to ${bobBalanceAfter}`);
    }, 30000);
  });
});
