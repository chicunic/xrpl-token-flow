import {
  type AccountLinesTrustline,
  type AccountSet,
  AccountSetAsfFlags,
  type Client,
  convertStringToHex,
  type Payment,
  type Wallet,
} from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, DOMAIN, MINT_AMOUNT, TRANSFER_AMOUNT } from '../../utils/data';
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

describe('DefaultRipple Flag Test', () => {
  let client: Client;

  let aliceWallet: Wallet;
  let bobWallet: Wallet;
  let issuerWithDefaultRipple: Wallet;
  let issuerWithoutDefaultRipple: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting DefaultRipple Flag Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create two issuers (with/without DefaultRipple), Alice, Bob');
    console.log('  Phase 2: Test Issuer WITH DefaultRipple — Alice→Bob transfer succeeds');
    console.log('  Phase 3: Test Issuer WITHOUT DefaultRipple — Alice→Bob transfer fails (tecPATH_DRY)');

    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Setup - Create Issuers and User Accounts', () => {
    it('should create and fund all wallets', async () => {
      console.log('\n==================== PHASE 1: SETUP - CREATE ISSUERS AND USER ACCOUNTS ====================');

      const wallets = await setupWallets(4);
      issuerWithDefaultRipple = wallets[0]!;
      issuerWithoutDefaultRipple = wallets[1]!;
      aliceWallet = wallets[2]!;
      bobWallet = wallets[3]!;

      console.log(`✅ Issuer with DefaultRipple: ${issuerWithDefaultRipple.address}`);
      console.log(`✅ Issuer without DefaultRipple: ${issuerWithoutDefaultRipple.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 80000);

    it('should configure issuer WITH DefaultRipple flag', async () => {
      console.log('⚙️ Setting up issuer account WITH DefaultRipple...');

      const setupTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWithDefaultRipple.address,
        Domain: convertStringToHex(DOMAIN),
        SetFlag: AccountSetAsfFlags.asfDefaultRipple,
      });
      await submitTransaction(client, setupTx, issuerWithDefaultRipple);

      const flags = await getAccountFlags(client, issuerWithDefaultRipple.address);
      expect(hasFlag(flags, AccountRootFlags.lsfDefaultRipple)).toBe(true);

      console.log('✅ Issuer setup complete WITH DefaultRipple flag');
    }, 20000);

    it('should configure issuer WITHOUT DefaultRipple flag', async () => {
      console.log('⚙️ Setting up issuer account WITHOUT DefaultRipple...');

      const setupTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWithoutDefaultRipple.address,
        Domain: convertStringToHex(DOMAIN),
      });
      await submitTransaction(client, setupTx, issuerWithoutDefaultRipple);

      const flags = await getAccountFlags(client, issuerWithoutDefaultRipple.address);
      expect(hasFlag(flags, AccountRootFlags.lsfDefaultRipple)).toBe(false);

      console.log('✅ Issuer setup complete WITHOUT DefaultRipple flag');
    }, 20000);
  });

  describe('Phase 2: Test Issuer WITH DefaultRipple', () => {
    it('should create trust lines to issuer with DefaultRipple', async () => {
      console.log('\n==================== PHASE 2: TEST ISSUER WITH DEFAULTRIPPLE ====================');

      await createTrustLine(aliceWallet, issuerWithDefaultRipple);
      await createTrustLine(bobWallet, issuerWithDefaultRipple);

      // Verify ripple flags on trust lines
      const aliceAccountLines = await client.request({
        command: 'account_lines',
        account: aliceWallet.address,
        peer: issuerWithDefaultRipple.address,
      });
      const aliceLine = aliceAccountLines.result.lines.find(
        (l: AccountLinesTrustline) =>
          l.currency === currencyToHex(CURRENCY) && l.account === issuerWithDefaultRipple.address
      );
      expect(aliceLine?.no_ripple).toBeFalsy();
      expect(aliceLine?.no_ripple_peer).toBeFalsy();

      const bobAccountLines = await client.request({
        command: 'account_lines',
        account: bobWallet.address,
        peer: issuerWithDefaultRipple.address,
      });
      const bobLine = bobAccountLines.result.lines.find(
        (l: AccountLinesTrustline) =>
          l.currency === currencyToHex(CURRENCY) && l.account === issuerWithDefaultRipple.address
      );
      expect(bobLine?.no_ripple).toBeFalsy();
      expect(bobLine?.no_ripple_peer).toBeFalsy();

      console.log('✅ Trust lines created to issuer WITH DefaultRipple');
    }, 40000);

    it('should issue USD tokens to Alice and succeed Alice -> Bob transfer', async () => {
      console.log('💰 Issuing USD tokens to Alice and testing transfer...');

      await mintTokens(issuerWithDefaultRipple, aliceWallet, MINT_AMOUNT);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWithDefaultRipple);
      expect(aliceBalance).toBe(MINT_AMOUNT);

      const paymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWithDefaultRipple.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, paymentTx, aliceWallet);

      const bobBalance = await getTokenBalance(bobWallet, issuerWithDefaultRipple);
      expect(bobBalance).toBe(TRANSFER_AMOUNT);

      console.log(`✅ Transfer successful with DefaultRipple issuer: Alice -> Bob (${TRANSFER_AMOUNT} ${CURRENCY})`);
    }, 40000);
  });

  describe('Phase 3: Test Issuer WITHOUT DefaultRipple', () => {
    it('should create trust lines to issuer without DefaultRipple', async () => {
      console.log('\n==================== PHASE 3: TEST ISSUER WITHOUT DEFAULTRIPPLE ====================');

      await createTrustLine(aliceWallet, issuerWithoutDefaultRipple);
      await createTrustLine(bobWallet, issuerWithoutDefaultRipple);

      // Verify NoRipple flags are set on peer side (expected without DefaultRipple)
      const aliceAccountLines = await client.request({
        command: 'account_lines',
        account: aliceWallet.address,
        peer: issuerWithoutDefaultRipple.address,
      });
      const aliceLine = aliceAccountLines.result.lines.find(
        (l: AccountLinesTrustline) =>
          l.currency === currencyToHex(CURRENCY) && l.account === issuerWithoutDefaultRipple.address
      );
      expect(aliceLine?.no_ripple).toBeFalsy();
      expect(aliceLine?.no_ripple_peer).toBeTruthy();

      const bobAccountLines = await client.request({
        command: 'account_lines',
        account: bobWallet.address,
        peer: issuerWithoutDefaultRipple.address,
      });
      const bobLine = bobAccountLines.result.lines.find(
        (l: AccountLinesTrustline) =>
          l.currency === currencyToHex(CURRENCY) && l.account === issuerWithoutDefaultRipple.address
      );
      expect(bobLine?.no_ripple).toBeFalsy();
      expect(bobLine?.no_ripple_peer).toBeTruthy();

      console.log('✅ Trust lines created to issuer WITHOUT DefaultRipple');
    }, 40000);

    it('should fail Alice -> Bob transfer with non-DefaultRipple issuer', async () => {
      console.log('🙅 Testing transfer failure with non-DefaultRipple issuer...');

      await mintTokens(issuerWithoutDefaultRipple, aliceWallet, MINT_AMOUNT);

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWithoutDefaultRipple);
      expect(BigInt(bobBalanceBefore)).toEqual(0n);

      const failedPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWithoutDefaultRipple.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, failedPaymentTx, aliceWallet, 'tecPATH_DRY');

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWithoutDefaultRipple);
      expect(bobBalanceAfter).toBe(bobBalanceBefore);

      console.log('✅ Transfer correctly failed without DefaultRipple: tecPATH_DRY');
    }, 50000);
  });
});
