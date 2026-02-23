import { type AccountSet, AccountSetAsfFlags, type Client, type Payment, type Wallet } from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT } from '../../utils/data';
import {
  createTrustLine,
  currencyToHex,
  getAccountFlags,
  getTokenBalance,
  hasFlag,
  mintTokens,
  setupIssuerWithFlags,
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

describe('GlobalFreeze Flag Test', () => {
  let client: Client;

  let aliceWallet: Wallet;
  let bobWallet: Wallet;
  let issuerWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting GlobalFreeze Flag Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer, Alice, Bob with DefaultRipple');
    console.log('  Phase 2: Normal Operations — issue tokens to Alice and Bob');
    console.log('  Phase 3: Enable GlobalFreeze — user transfers fail, issuer mint/burn still works');
    console.log('  Phase 4: Disable GlobalFreeze — transfers restored');

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

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfGlobalFreeze)).toBe(false);

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

      const freezeTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: AccountSetAsfFlags.asfGlobalFreeze,
      });
      await submitTransaction(client, freezeTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfGlobalFreeze)).toBe(true);

      console.log('✅ GlobalFreeze flag enabled successfully');
    }, 20000);

    it('should fail Alice -> Bob transfer with GlobalFreeze enabled', async () => {
      console.log('🙅 Testing transfer failure with GlobalFreeze enabled...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const failedPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, failedPaymentTx, aliceWallet, 'tecPATH_DRY');

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log('✅ Transfer correctly failed with GlobalFreeze: tecPATH_DRY');
    }, 30000);

    it('should fail Bob -> Alice transfer with GlobalFreeze enabled', async () => {
      console.log('🙅 Testing reverse transfer failure with GlobalFreeze enabled...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      const failedPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: aliceWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, failedPaymentTx, bobWallet, 'tecPATH_DRY');

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

      const burnTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, burnTx, aliceWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(BigInt(aliceBalanceAfter)).toEqual(BigInt(aliceBalanceBefore) - BigInt(TRANSFER_AMOUNT));

      console.log('✅ Burn operation successful with GlobalFreeze enabled');
      console.log(`✅ Alice balance decreased from ${aliceBalanceBefore} to ${aliceBalanceAfter}`);
    }, 30000);

    it('should allow users to burn tokens by sending to issuer with GlobalFreeze enabled', async () => {
      console.log('🔥 Testing user-initiated burn with GlobalFreeze enabled...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const burnFromBobTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, burnFromBobTx, bobWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) - BigInt(TRANSFER_AMOUNT));

      console.log('✅ User-initiated burn successful with GlobalFreeze enabled');
      console.log(`✅ Bob balance decreased from ${bobBalanceBefore} to ${bobBalanceAfter}`);
    }, 30000);
  });

  describe('Phase 4: Disable GlobalFreeze', () => {
    it('should disable GlobalFreeze flag', async () => {
      console.log('\n==================== PHASE 4: DISABLE GLOBALFREEZE ====================');

      const unfreezeTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        ClearFlag: AccountSetAsfFlags.asfGlobalFreeze,
      });
      await submitTransaction(client, unfreezeTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfGlobalFreeze)).toBe(false);

      console.log('✅ GlobalFreeze flag disabled successfully');
    }, 20000);

    it('should succeed Alice -> Bob transfer after disabling GlobalFreeze', async () => {
      console.log('✅ Testing transfer success after disabling GlobalFreeze...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const paymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, paymentTx, aliceWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Transfer successful after unfreezing: Alice -> Bob (${TRANSFER_AMOUNT} ${CURRENCY})`);
      console.log(`✅ Bob balance increased from ${bobBalanceBefore} to ${bobBalanceAfter}`);
    }, 30000);
  });
});
