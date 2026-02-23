import {
  type AccountSet,
  AccountSetAsfFlags,
  type Client,
  type DepositPreauth,
  dropsToXrp,
  type Payment,
  type Wallet,
  xrpToDrops,
} from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT, XRP_TRANSFER_AMOUNT } from '../../utils/data';
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

describe('DepositAuth Flag Test', () => {
  let client: Client;

  let aliceWallet: Wallet;
  let bobWallet: Wallet;
  let issuerWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting DepositAuth Flag Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer, Alice, Bob with DefaultRipple');
    console.log('  Phase 2: Trust Lines and Token Setup');
    console.log('  Phase 3: Enable DepositAuth on Bob — incoming payments blocked');
    console.log('  Phase 4: DepositPreauth Lifecycle — preauthorize/unauthorize Alice');
    console.log('  Phase 5: Disable DepositAuth — normal payment behavior restored');

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

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 60000);
  });

  describe('Phase 2: Trust Lines and Token Setup', () => {
    it('should create trust lines and issue tokens to Alice and Bob', async () => {
      console.log('\n==================== PHASE 2: TRUST LINES AND TOKEN SETUP ====================');

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

  describe('Phase 3: Enable DepositAuth on Bob', () => {
    it('should enable DepositAuth flag on Bob', async () => {
      console.log('\n==================== PHASE 3: ENABLE DEPOSITAUTH ON BOB ====================');

      const depositAuthTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: bobWallet.address,
        SetFlag: AccountSetAsfFlags.asfDepositAuth,
      });
      await submitTransaction(client, depositAuthTx, bobWallet);

      const flags = await getAccountFlags(client, bobWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfDepositAuth)).toBe(true);

      console.log('✅ DepositAuth flag enabled on Bob successfully');
    }, 20000);

    it('should fail Alice -> Bob USD transfer with DepositAuth enabled', async () => {
      console.log('🙅 Testing Alice -> Bob USD transfer failure with DepositAuth enabled...');

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
      await submitTransaction(client, failedPaymentTx, aliceWallet, 'tecNO_PERMISSION');

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log('✅ Alice -> Bob USD transfer correctly failed with DepositAuth');
    }, 30000);

    it('should fail Alice -> Bob XRP transfer with DepositAuth enabled', async () => {
      console.log('🙅 Testing Alice -> Bob XRP transfer failure with DepositAuth enabled...');

      const bobInfoBefore = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobXrpBalanceBefore = BigInt(bobInfoBefore.result.account_data.Balance);

      const failedXRPPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      await submitTransaction(client, failedXRPPaymentTx, aliceWallet, 'tecNO_PERMISSION');

      const bobInfoAfter = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      expect(BigInt(bobInfoAfter.result.account_data.Balance)).toEqual(bobXrpBalanceBefore);

      console.log('✅ Alice -> Bob XRP transfer correctly failed with DepositAuth');
    }, 30000);

    it('should fail Issuer -> Bob USD mint with DepositAuth enabled', async () => {
      console.log('🙅 Testing Issuer -> Bob USD mint failure with DepositAuth enabled...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const issuerMintTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: MINT_AMOUNT,
        },
      });
      await submitTransaction(client, issuerMintTx, issuerWallet, 'tecNO_PERMISSION');

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log('✅ Issuer -> Bob USD mint correctly failed with DepositAuth');
    }, 30000);

    it('should succeed Bob -> Alice USD transfer with DepositAuth enabled', async () => {
      console.log('✅ Testing Bob -> Alice USD transfer success with DepositAuth enabled...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      const bobPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: aliceWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, bobPaymentTx, bobWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(BigInt(aliceBalanceAfter)).toEqual(BigInt(aliceBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Bob -> Alice USD transfer successful (${TRANSFER_AMOUNT} ${CURRENCY})`);
    }, 30000);

    it('should succeed Bob -> Alice XRP transfer with DepositAuth enabled', async () => {
      console.log('✅ Testing Bob -> Alice XRP transfer success with DepositAuth enabled...');

      const aliceInfoBefore = await client.request({
        command: 'account_info',
        account: aliceWallet.address,
        ledger_index: 'validated',
      });
      const aliceXrpBalanceBefore = BigInt(aliceInfoBefore.result.account_data.Balance);

      const bobXRPPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: aliceWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      await submitTransaction(client, bobXRPPaymentTx, bobWallet);

      const aliceInfoAfter = await client.request({
        command: 'account_info',
        account: aliceWallet.address,
        ledger_index: 'validated',
      });
      const aliceXrpBalanceAfter = BigInt(aliceInfoAfter.result.account_data.Balance);
      expect(aliceXrpBalanceAfter).toEqual(aliceXrpBalanceBefore + BigInt(xrpToDrops(XRP_TRANSFER_AMOUNT)));

      console.log(`✅ Bob -> Alice XRP transfer successful (${XRP_TRANSFER_AMOUNT} XRP)`);
      console.log(
        `✅ Alice XRP balance: ${dropsToXrp(aliceXrpBalanceBefore)} XRP -> ${dropsToXrp(aliceXrpBalanceAfter)} XRP`
      );
    }, 30000);
  });

  describe('Phase 4: DepositPreauth', () => {
    it('should preauthorize Alice to send to Bob', async () => {
      console.log('\n==================== PHASE 4: DEPOSITPREAUTH ====================');

      const preauthAliceTx: DepositPreauth = await client.autofill({
        TransactionType: 'DepositPreauth',
        Account: bobWallet.address,
        Authorize: aliceWallet.address,
      });
      await submitTransaction(client, preauthAliceTx, bobWallet);

      console.log('✅ Bob has preauthorized Alice to send deposits');
    }, 10000);

    it('should succeed Alice -> Bob USD transfer after preauthorization', async () => {
      console.log('✅ Testing Alice -> Bob USD transfer after preauthorization...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const alicePaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, alicePaymentTx, aliceWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`✅ Alice -> Bob USD transfer successful after preauthorization (${TRANSFER_AMOUNT} ${CURRENCY})`);
    }, 30000);

    it('should succeed Alice -> Bob XRP transfer after preauthorization', async () => {
      console.log('✅ Testing Alice -> Bob XRP transfer after preauthorization...');

      const bobInfoBefore = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobXrpBalanceBefore = BigInt(bobInfoBefore.result.account_data.Balance);

      const aliceXRPPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      await submitTransaction(client, aliceXRPPaymentTx, aliceWallet);

      const bobInfoAfter = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobXrpBalanceAfter = BigInt(bobInfoAfter.result.account_data.Balance);
      expect(bobXrpBalanceAfter).toEqual(bobXrpBalanceBefore + BigInt(xrpToDrops(XRP_TRANSFER_AMOUNT)));

      console.log(`✅ Alice -> Bob XRP transfer successful after preauthorization (${XRP_TRANSFER_AMOUNT} XRP)`);
    }, 30000);

    it('should unauthorize Alice (remove preauthorization)', async () => {
      console.log('🔒 Bob removing preauthorization for Alice...');

      const unauthorizeTx: DepositPreauth = await client.autofill({
        TransactionType: 'DepositPreauth',
        Account: bobWallet.address,
        Unauthorize: aliceWallet.address,
      });
      await submitTransaction(client, unauthorizeTx, bobWallet);

      console.log('✅ Bob has removed preauthorization for Alice');
    }, 10000);

    it('should fail Alice -> Bob USD transfer after removing preauthorization', async () => {
      console.log('🙅 Testing Alice -> Bob USD transfer failure after removing preauthorization...');

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
      await submitTransaction(client, failedPaymentTx, aliceWallet, 'tecNO_PERMISSION');

      expect(await getTokenBalance(bobWallet, issuerWallet)).toBe(bobBalanceBefore);

      console.log('✅ Alice -> Bob USD transfer correctly failed after removing preauthorization');
    }, 30000);

    it('should fail Alice -> Bob XRP transfer after removing preauthorization', async () => {
      console.log('🙅 Testing Alice -> Bob XRP transfer failure after removing preauthorization...');

      const bobInfoBefore = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobXrpBalanceBefore = BigInt(bobInfoBefore.result.account_data.Balance);

      const failedXRPPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      await submitTransaction(client, failedXRPPaymentTx, aliceWallet, 'tecNO_PERMISSION');

      const bobInfoAfter = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      expect(BigInt(bobInfoAfter.result.account_data.Balance)).toEqual(bobXrpBalanceBefore);

      console.log('✅ Alice -> Bob XRP transfer correctly failed after removing preauthorization');
    }, 30000);
  });

  describe('Phase 5: Disable DepositAuth', () => {
    it('should disable DepositAuth flag on Bob', async () => {
      console.log('\n==================== PHASE 5: DISABLE DEPOSITAUTH ====================');

      const clearDepositAuthTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: bobWallet.address,
        ClearFlag: AccountSetAsfFlags.asfDepositAuth,
      });
      await submitTransaction(client, clearDepositAuthTx, bobWallet);

      const flags = await getAccountFlags(client, bobWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfDepositAuth)).toBe(false);

      console.log('✅ DepositAuth flag disabled on Bob successfully');
    }, 20000);

    it('should succeed Alice -> Bob transfer after disabling DepositAuth', async () => {
      console.log('✅ Testing Alice -> Bob transfer after disabling DepositAuth...');

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

      console.log(`✅ Transfer successful after disabling DepositAuth: Alice -> Bob (${TRANSFER_AMOUNT} ${CURRENCY})`);
    }, 30000);

    it('should succeed Alice -> Bob XRP transfer after disabling DepositAuth', async () => {
      console.log('✅ Testing Alice -> Bob XRP transfer after disabling DepositAuth...');

      const bobInfoBefore = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobXrpBalanceBefore = BigInt(bobInfoBefore.result.account_data.Balance);

      const xrpPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      await submitTransaction(client, xrpPaymentTx, aliceWallet);

      const bobInfoAfter = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobXrpBalanceAfter = BigInt(bobInfoAfter.result.account_data.Balance);
      expect(bobXrpBalanceAfter).toEqual(bobXrpBalanceBefore + BigInt(xrpToDrops(XRP_TRANSFER_AMOUNT)));

      console.log(`✅ Alice -> Bob XRP transfer successful after disabling DepositAuth (${XRP_TRANSFER_AMOUNT} XRP)`);
      console.log(
        `✅ Bob XRP balance: ${dropsToXrp(bobXrpBalanceBefore)} XRP -> ${dropsToXrp(bobXrpBalanceAfter)} XRP`
      );
    }, 30000);
  });
});
