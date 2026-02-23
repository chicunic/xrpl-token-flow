import {
  type AccountSet,
  AccountSetAsfFlags,
  type Client,
  dropsToXrp,
  type Payment,
  type Wallet,
  xrpToDrops,
} from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { XRP_TRANSFER_AMOUNT } from '../../utils/data';
import { getAccountFlags, hasFlag, setupWallets, submitTransaction } from '../../utils/test.helper';

describe('DisallowXRP Flag Test', () => {
  let client: Client;

  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting DisallowXRP Flag Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Alice and Bob accounts');
    console.log('  Phase 2: Enable DisallowXRP on Bob — transfers still succeed (advisory only)');
    console.log('  Phase 3: Disable DisallowXRP — transfers continue normally');

    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Setup - Create Test Accounts', () => {
    it('should create and fund all wallets', async () => {
      console.log('\n==================== PHASE 1: SETUP - CREATE TEST ACCOUNTS ====================');

      const wallets = await setupWallets(2);
      aliceWallet = wallets[0]!;
      bobWallet = wallets[1]!;

      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 40000);
  });

  describe('Phase 2: Enable DisallowXRP on Bob', () => {
    it('should enable DisallowXRP flag on Bob', async () => {
      console.log('\n==================== PHASE 2: ENABLE DISALLOWXRP ON BOB ====================');

      const disallowXRPTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: bobWallet.address,
        SetFlag: AccountSetAsfFlags.asfDisallowXRP,
      });
      await submitTransaction(client, disallowXRPTx, bobWallet);

      const flags = await getAccountFlags(client, bobWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfDisallowXRP)).toBe(true);

      console.log('✅ DisallowXRP flag enabled on Bob successfully');
    }, 20000);

    it('should succeed Alice -> Bob XRP transfer with DisallowXRP enabled (advisory only)', async () => {
      console.log('ℹ️ Testing Alice -> Bob XRP transfer with DisallowXRP enabled (advisory flag)...');

      const bobInfoBefore = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobBalanceBeforeDrops = BigInt(bobInfoBefore.result.account_data.Balance);

      const paymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      // DisallowXRP is NOT enforced by XRPL protocol - it's advisory only
      await submitTransaction(client, paymentTx, aliceWallet);

      const bobInfoAfter = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobBalanceAfterDrops = BigInt(bobInfoAfter.result.account_data.Balance);
      expect(bobBalanceAfterDrops).toEqual(bobBalanceBeforeDrops + BigInt(xrpToDrops(XRP_TRANSFER_AMOUNT)));

      console.log(
        `ℹ️ DisallowXRP flag is advisory only - XRPL protocol allows XRP transfers to prevent accounts becoming unusable`
      );
      console.log(`✅ XRP transfer succeeded: Alice -> Bob (${XRP_TRANSFER_AMOUNT} XRP)`);
      console.log(
        `✅ Bob balance: ${dropsToXrp(bobBalanceBeforeDrops)} XRP -> ${dropsToXrp(bobBalanceAfterDrops)} XRP`
      );
    }, 30000);

    it('should allow Bob to send XRP to others with DisallowXRP enabled', async () => {
      console.log('💸 Testing Bob -> Alice XRP transfer with Bob having DisallowXRP...');

      const aliceInfoBefore = await client.request({
        command: 'account_info',
        account: aliceWallet.address,
        ledger_index: 'validated',
      });
      const aliceBalanceBeforeDrops = BigInt(aliceInfoBefore.result.account_data.Balance);

      const bobPaymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: aliceWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      await submitTransaction(client, bobPaymentTx, bobWallet);

      const aliceInfoAfter = await client.request({
        command: 'account_info',
        account: aliceWallet.address,
        ledger_index: 'validated',
      });
      const aliceBalanceAfterDrops = BigInt(aliceInfoAfter.result.account_data.Balance);
      expect(aliceBalanceAfterDrops).toEqual(aliceBalanceBeforeDrops + BigInt(xrpToDrops(XRP_TRANSFER_AMOUNT)));

      console.log('✅ Bob can still send XRP to others with DisallowXRP enabled');
      console.log(
        `✅ Alice balance: ${dropsToXrp(aliceBalanceBeforeDrops)} XRP -> ${dropsToXrp(aliceBalanceAfterDrops)} XRP`
      );
    }, 30000);
  });

  describe('Phase 3: Disable DisallowXRP', () => {
    it('should disable DisallowXRP flag on Bob', async () => {
      console.log('\n==================== PHASE 3: DISABLE DISALLOWXRP ====================');

      const clearDisallowXRPTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: bobWallet.address,
        ClearFlag: AccountSetAsfFlags.asfDisallowXRP,
      });
      await submitTransaction(client, clearDisallowXRPTx, bobWallet);

      const flags = await getAccountFlags(client, bobWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfDisallowXRP)).toBe(false);

      console.log('✅ DisallowXRP flag disabled on Bob successfully');
    }, 20000);

    it('should succeed Alice -> Bob XRP transfer after disabling DisallowXRP', async () => {
      console.log('✅ Testing Alice -> Bob XRP transfer after disabling DisallowXRP...');

      const bobInfoBefore = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobBalanceBefore = BigInt(bobInfoBefore.result.account_data.Balance);

      const paymentTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: xrpToDrops(XRP_TRANSFER_AMOUNT),
      });
      await submitTransaction(client, paymentTx, aliceWallet);

      const bobInfoAfter = await client.request({
        command: 'account_info',
        account: bobWallet.address,
        ledger_index: 'validated',
      });
      const bobBalanceAfter = BigInt(bobInfoAfter.result.account_data.Balance);
      expect(bobBalanceAfter).toEqual(bobBalanceBefore + BigInt(xrpToDrops(XRP_TRANSFER_AMOUNT)));

      console.log(`✅ XRP transfer successful after disabling DisallowXRP: Alice -> Bob (${XRP_TRANSFER_AMOUNT} XRP)`);
      console.log(`✅ Bob balance: ${dropsToXrp(bobBalanceBefore)} XRP -> ${dropsToXrp(bobBalanceAfter)} XRP`);
    }, 30000);
  });
});
