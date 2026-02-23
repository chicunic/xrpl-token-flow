import type { CheckCancel, CheckCash, CheckCreate, Client, CreatedNode, TransactionMetadata, Wallet } from 'xrpl';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT } from '../../utils/data';
import {
  createTrustLine,
  currencyToHex,
  getTokenBalance,
  mintTokens,
  setupIssuerWithFlags,
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

// Extract the Check ledger entry ID from a CheckCreate transaction result
function extractCheckId(meta: TransactionMetadata): string {
  const createdNode = meta.AffectedNodes?.find(node => (node as CreatedNode).CreatedNode?.LedgerEntryType === 'Check');
  return (createdNode as CreatedNode)?.CreatedNode?.LedgerIndex;
}

describe('Check Test', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting Check Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer, Alice, Bob with DefaultRipple');
    console.log('  Phase 2: Trust Lines and Token Setup');
    console.log('  Phase 3: Check Creation and Cash (Alice creates check, Bob cashes it)');
    console.log('  Phase 4: Check Cancellation Testing (sender and receiver cancel checks)');

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

  describe('Phase 3: Check Creation and Cash', () => {
    let checkId: string;

    it('should allow Alice to create a check payable to Bob', async () => {
      console.log('\n==================== PHASE 3: CHECK CREATION AND CASH ====================');
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

      checkId = extractCheckId(result.result.meta as TransactionMetadata);
      expect(checkId).toBeDefined();
      console.log(`✅ Check created successfully with ID: ${checkId}`);
    }, 10000);

    it('should allow Bob to cash the check and receive tokens', async () => {
      console.log('💰 Bob cashing the check to receive tokens...');

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
        `✅ Check cashed successfully: Alice ${aliceBalanceBefore} -> ${aliceBalanceAfter} ${CURRENCY}, Bob ${bobBalanceBefore} -> ${bobBalanceAfter} ${CURRENCY}`
      );
    }, 50000);
  });

  describe('Phase 4: Check Cancellation Testing', () => {
    let firstCheckId: string;
    let secondCheckId: string;

    it('should create two checks for cancellation testing', async () => {
      console.log('\n==================== PHASE 4: CHECK CANCELLATION TESTING ====================');
      console.log('📝 Alice creating two checks payable to Bob...');

      const firstCheckCreateTx: CheckCreate = await client.autofill({
        TransactionType: 'CheckCreate',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        SendMax: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });

      const firstSigned = aliceWallet.sign(firstCheckCreateTx);
      const firstResult = await client.submitAndWait(firstSigned.tx_blob);
      expect((firstResult.result.meta as TransactionMetadata)?.TransactionResult).toBe('tesSUCCESS');
      firstCheckId = extractCheckId(firstResult.result.meta as TransactionMetadata);
      expect(firstCheckId).toBeDefined();

      const secondCheckCreateTx: CheckCreate = await client.autofill({
        TransactionType: 'CheckCreate',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        SendMax: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });

      const secondSigned = aliceWallet.sign(secondCheckCreateTx);
      const secondResult = await client.submitAndWait(secondSigned.tx_blob);
      expect((secondResult.result.meta as TransactionMetadata)?.TransactionResult).toBe('tesSUCCESS');
      secondCheckId = extractCheckId(secondResult.result.meta as TransactionMetadata);
      expect(secondCheckId).toBeDefined();

      console.log(`✅ Two checks created successfully with IDs: ${firstCheckId}, ${secondCheckId}`);
    }, 20000);

    it('should allow Alice to cancel first check', async () => {
      console.log('❌ Alice canceling the first check...');

      const checkCancelTx: CheckCancel = await client.autofill({
        TransactionType: 'CheckCancel',
        Account: aliceWallet.address,
        CheckID: firstCheckId,
      });
      await submitTransaction(client, checkCancelTx, aliceWallet);

      console.log('✅ First check canceled by Alice successfully');
    }, 10000);

    it('should fail when Bob tries to cash the first canceled check', async () => {
      console.log('❌ Bob attempting to cash the canceled first check (should fail)...');

      const checkCashTx: CheckCash = await client.autofill({
        TransactionType: 'CheckCash',
        Account: bobWallet.address,
        CheckID: firstCheckId,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, checkCashTx, bobWallet, 'tecNO_ENTRY');

      console.log('✅ Bob correctly failed to cash canceled check');
    }, 10000);

    it('should allow Bob to cancel second check', async () => {
      console.log('❌ Bob canceling the second check...');

      const checkCancelTx: CheckCancel = await client.autofill({
        TransactionType: 'CheckCancel',
        Account: bobWallet.address,
        CheckID: secondCheckId,
      });
      await submitTransaction(client, checkCancelTx, bobWallet);

      console.log('✅ Second check canceled by Bob successfully');
    }, 10000);

    it('should fail when Bob tries to cash the second canceled check', async () => {
      console.log('❌ Bob attempting to cash the canceled second check (should fail)...');

      const checkCashTx: CheckCash = await client.autofill({
        TransactionType: 'CheckCash',
        Account: bobWallet.address,
        CheckID: secondCheckId,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, checkCashTx, bobWallet, 'tecNO_ENTRY');

      console.log('✅ Bob correctly failed to cash canceled check');
    }, 10000);
  });
});
