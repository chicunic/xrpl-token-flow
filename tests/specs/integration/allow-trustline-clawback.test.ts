import {
  type AccountSet,
  AccountSetAsfFlags,
  type Clawback,
  type Client,
  convertStringToHex,
  type Payment,
  type Wallet,
} from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CLAWBACK_AMOUNT, CURRENCY, DOMAIN, MINT_AMOUNT, TRANSFER_AMOUNT } from '../../utils/data';
import {
  createTrustLine,
  currencyToHex,
  getAccountFlags,
  getTokenBalance,
  hasFlag,
  mintTokens,
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

describe('AllowTrustLineClawback Flag Test', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting AllowTrustLineClawback Flag Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer and User Accounts, set AllowTrustLineClawback');
    console.log('  Phase 2: Trust Lines and Token Setup');
    console.log('  Phase 3: Test Clawback Operations (clawback from Bob, excessive clawback)');
    console.log('  Phase 4: Test Clawback Permanence (cannot clear AllowTrustLineClawback)');

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
    it('should create and fund all wallets', async () => {
      console.log('\n==================== PHASE 1: SETUP - CREATE ISSUER AND USER ACCOUNTS ====================');
      console.log('👥 Creating issuer, Alice, and Bob wallets...');

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 60000);

    it('should configure issuer account with AllowTrustLineClawback', async () => {
      console.log('🏦 Configuring issuer account with AllowTrustLineClawback flag...');

      const clawbackTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        Domain: convertStringToHex(DOMAIN),
        SetFlag: AccountSetAsfFlags.asfAllowTrustLineClawback,
      });
      await submitTransaction(client, clawbackTx, issuerWallet);

      const defaultRippleTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: AccountSetAsfFlags.asfDefaultRipple,
      });
      await submitTransaction(client, defaultRippleTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfAllowTrustLineClawback)).toBe(true);
      expect(hasFlag(flags, AccountRootFlags.lsfDefaultRipple)).toBe(true);

      console.log('✅ AllowTrustLineClawback and DefaultRipple flags enabled on issuer successfully');
    }, 30000);
  });

  describe('Phase 2: Trust Lines and Token Setup', () => {
    it('should create trust lines and issue tokens to Alice', async () => {
      console.log('\n==================== PHASE 2: TRUST LINES AND TOKEN SETUP ====================');

      await createTrustLine(aliceWallet, issuerWallet);
      await createTrustLine(bobWallet, issuerWallet);

      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      expect(aliceBalance).toBe(MINT_AMOUNT);

      console.log('✅ Trust lines created and tokens issued successfully');
      console.log(`✅ Alice now has ${MINT_AMOUNT} ${CURRENCY}`);
    }, 60000);
  });

  describe('Phase 3: Test Clawback Operations', () => {
    it('should allow Alice to transfer tokens to Bob', async () => {
      console.log('\n==================== PHASE 3: TEST CLAWBACK OPERATIONS ====================');
      console.log('💸 Alice transferring tokens to Bob...');

      const transferTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, transferTx, aliceWallet);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalance = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(aliceBalance)).toEqual(BigInt(MINT_AMOUNT) - BigInt(TRANSFER_AMOUNT));
      expect(BigInt(bobBalance)).toEqual(BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Transfer successful: Alice has ${aliceBalance} ${CURRENCY}, Bob has ${bobBalance} ${CURRENCY}`);
    }, 30000);

    it('should succeed issuer clawback from Bob', async () => {
      console.log('🔄 Testing issuer clawback from Bob...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const clawbackTx: Clawback = await client.autofill({
        TransactionType: 'Clawback',
        Account: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: bobWallet.address, // The token holder's account ID (not the token issuer)
          value: CLAWBACK_AMOUNT,
        },
      });
      await submitTransaction(client, clawbackTx, issuerWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) - BigInt(CLAWBACK_AMOUNT));

      console.log(`✅ Clawback successful: Bob balance ${bobBalanceBefore} -> ${bobBalanceAfter} ${CURRENCY}`);
    }, 30000);

    it('should clawback entire balance when amount exceeds current balance', async () => {
      console.log('💰 Testing clawback of more than available balance (claws back entire balance)...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const excessiveClawbackTx: Clawback = await client.autofill({
        TransactionType: 'Clawback',
        Account: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: bobWallet.address, // The token holder's account ID (not the token issuer)
          value: MINT_AMOUNT, // More than Bob should have
        },
      });
      // Transaction succeeds but claws back entire balance instead of failing
      await submitTransaction(client, excessiveClawbackTx, issuerWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(0n);

      console.log(`✅ Entire balance clawed back: Bob ${bobBalanceBefore} -> ${bobBalanceAfter} ${CURRENCY}`);
    }, 30000);
  });

  describe('Phase 4: Test Clawback Permanence', () => {
    it('should succeed clear AllowTrustLineClawback transaction but flag remains set (permanent)', async () => {
      console.log('\n==================== PHASE 4: TEST CLAWBACK PERMANENCE ====================');
      console.log('🔄 Attempting to clear AllowTrustLineClawback flag (transaction succeeds but flag remains)...');

      const clearClawbackTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        ClearFlag: AccountSetAsfFlags.asfAllowTrustLineClawback,
      });
      // Transaction succeeds but does nothing - AllowTrustLineClawback cannot be cleared once set
      await submitTransaction(client, clearClawbackTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfAllowTrustLineClawback)).toBe(true);

      console.log(
        '✅ Clear transaction succeeded but did nothing - AllowTrustLineClawback flag remains enabled (permanent)'
      );
    }, 20000);
  });
});
