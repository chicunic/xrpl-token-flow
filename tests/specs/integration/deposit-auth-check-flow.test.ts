import {
  type AccountLinesTrustline,
  type AccountSet,
  AccountSetAsfFlags,
  type CheckCash,
  type CheckCreate,
  type Client,
  type CreatedNode,
  convertStringToHex,
  type TransactionMetadata,
  type TrustSet,
  TrustSetFlags,
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

describe('DepositAuth Check Test', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting DepositAuth Check Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer, Alice, Bob (without DefaultRipple)');
    console.log('  Phase 2: Trust Lines and Token Setup (clear NoRipple for Bob)');
    console.log('  Phase 3: DepositAuth + Check Payment (Bob cashes check despite DepositAuth)');

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

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 60000);

    it('should configure issuer account without DefaultRipple', async () => {
      console.log('🏦 Configuring issuer account without DefaultRipple flag...');

      const accountSetTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        Domain: convertStringToHex(DOMAIN),
      });
      await submitTransaction(client, accountSetTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfDefaultRipple)).toBe(false);

      console.log('✅ Issuer configured without DefaultRipple flag');
    }, 20000);
  });

  describe('Phase 2: Trust Lines and Token Setup', () => {
    it('should create trust lines to issuer', async () => {
      console.log('\n==================== PHASE 2: TRUST LINES AND TOKEN SETUP ====================');

      await createTrustLine(aliceWallet, issuerWallet);
      await createTrustLine(bobWallet, issuerWallet);

      console.log('✅ Trust lines created successfully');
    }, 40000);

    it('should issuer clear NoRipple flag for Bob trust line', async () => {
      console.log('🔄 Issuer clearing NoRipple flag for Bob trust line...');

      const clearNoRippleTx: TrustSet = await client.autofill({
        TransactionType: 'TrustSet',
        Account: issuerWallet.address,
        LimitAmount: {
          currency: currencyToHex(CURRENCY),
          issuer: bobWallet.address,
          value: '0', // Issuer sets limit to 0 but clears NoRipple flag
        },
        Flags: TrustSetFlags.tfClearNoRipple,
      });
      await submitTransaction(client, clearNoRippleTx, issuerWallet);

      const issuerAccountLines = await client.request({
        command: 'account_lines',
        account: issuerWallet.address,
        peer: bobWallet.address,
      });

      const issuerToBobLine = issuerAccountLines.result.lines.find(
        (l: AccountLinesTrustline) => l.currency === currencyToHex(CURRENCY) && l.account === bobWallet.address
      );
      expect(issuerToBobLine?.no_ripple).toBeFalsy();

      console.log('✅ Issuer cleared NoRipple flag for Bob trust line');
    }, 20000);

    it('should issue USD tokens to Alice', async () => {
      console.log('💰 Issuing USD tokens to Alice...');

      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      expect(aliceBalance).toBe(MINT_AMOUNT);

      console.log(`✅ Alice now has ${MINT_AMOUNT} ${CURRENCY}`);
    }, 20000);
  });

  describe('Phase 3: DepositAuth and Check Payment', () => {
    let checkId: string;

    it('should enable DepositAuth flag on Bob', async () => {
      console.log('\n==================== PHASE 3: DEPOSITAUTH AND CHECK PAYMENT ====================');

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

    it('should allow Alice to create a check payable to Bob', async () => {
      console.log('📝 Alice creating a check payable to Bob...');

      const checkCreateTx: CheckCreate = await client.autofill({
        TransactionType: 'CheckCreate',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        SendMax: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });

      const signed = aliceWallet.sign(checkCreateTx);
      const result = await client.submitAndWait(signed.tx_blob);
      expect((result.result.meta as TransactionMetadata)?.TransactionResult).toBe('tesSUCCESS');

      const meta = result.result.meta as TransactionMetadata;
      const createdNode = meta.AffectedNodes?.find(
        node => (node as CreatedNode).CreatedNode?.LedgerEntryType === 'Check'
      );
      checkId = (createdNode as CreatedNode)?.CreatedNode?.LedgerIndex;
      expect(checkId).toBeDefined();
      console.log(`✅ Check created successfully with ID: ${checkId}`);
    }, 10000);

    it('should allow Bob to cash the check despite DepositAuth being enabled', async () => {
      console.log('💰 Bob cashing the check with DepositAuth enabled...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const checkCashTx: CheckCash = await client.autofill({
        TransactionType: 'CheckCash',
        Account: bobWallet.address,
        CheckID: checkId,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, checkCashTx, bobWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(aliceBalanceAfter)).toEqual(BigInt(aliceBalanceBefore) - BigInt(TRANSFER_AMOUNT));
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(
        `✅ Check cashed successfully despite DepositAuth: Alice ${aliceBalanceBefore} -> ${aliceBalanceAfter} ${CURRENCY}, Bob ${bobBalanceBefore} -> ${bobBalanceAfter} ${CURRENCY}`
      );
      console.log('ℹ️ DepositAuth allows check cashing - account holder controls when to receive payments');
    }, 50000);
  });
});
