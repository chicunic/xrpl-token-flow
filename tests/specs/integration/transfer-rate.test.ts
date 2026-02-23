import type { AccountSet, Client, Payment, Wallet } from 'xrpl';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT, TRANSFER_RATE } from '../../utils/data';
import {
  createTrustLine,
  currencyToHex,
  getTokenBalance,
  mintTokens,
  setupIssuerWithFlags,
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

describe('TransferRate Test', () => {
  let client: Client;
  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting TransferRate Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer, Alice, Bob with DefaultRipple');
    console.log('  Phase 2: Set TransferRate=0.5%, verify account_info returns correct value');
    console.log('  Phase 3: Mint to Alice (no fee), Alice→Bob transfer verifies 0.5% deduction');
    console.log('  Phase 4: Issuer→user no fee, user→Issuer (redeem) no fee');
    console.log('  Phase 5: Clear rate (set to 0), verify no fee restored');
    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Setup - Create Issuer, Alice, Bob', () => {
    it('should create and fund all wallets with DefaultRipple', async () => {
      console.log('\n==================== PHASE 1: SETUP ====================');

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      await setupIssuerWithFlags(issuerWallet);

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 120000);
  });

  describe('Phase 2: Set TransferRate and verify', () => {
    it('should set TransferRate=0.5% and verify in account_info', async () => {
      console.log('\n==================== PHASE 2: SET TRANSFER RATE ====================');

      const setRateTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        TransferRate: TRANSFER_RATE,
      });
      await submitTransaction(client, setRateTx, issuerWallet);

      const accountInfo = await client.request({
        command: 'account_info',
        account: issuerWallet.address,
        ledger_index: 'validated',
      });

      expect(accountInfo.result.account_data.TransferRate).toBe(TRANSFER_RATE);
      console.log(`✅ TransferRate set to ${TRANSFER_RATE} (0.5%)`);
    }, 20000);
  });

  describe('Phase 3: Mint and transfer with fee', () => {
    it('should create trust lines and mint tokens', async () => {
      console.log('\n==================== PHASE 3: MINT AND TRANSFER WITH FEE ====================');

      await createTrustLine(aliceWallet, issuerWallet);
      await createTrustLine(bobWallet, issuerWallet);
      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      expect(aliceBalance).toBe(MINT_AMOUNT);
      console.log(`✅ Alice minted ${MINT_AMOUNT} ${CURRENCY} (no fee on issuer→user)`);
    }, 60000);

    it('should deduct 0.5% fee on Alice→Bob transfer', async () => {
      console.log('💸 Testing Alice→Bob transfer with 0.5% fee...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      // SendMax covers the transfer fee (0.5%)
      const sendMaxValue = String(Number(TRANSFER_AMOUNT) * 1.01);
      const payTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
        SendMax: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: sendMaxValue,
        },
      });
      await submitTransaction(client, payTx, aliceWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);

      expect(bobBalanceAfter).toBe(String(Number(bobBalanceBefore) + Number(TRANSFER_AMOUNT)));

      const alicePaid = Number(aliceBalanceBefore) - Number(aliceBalanceAfter);
      const expectedFee = Number(TRANSFER_AMOUNT) * 0.005;
      const expectedTotal = Number(TRANSFER_AMOUNT) + expectedFee;
      expect(alicePaid).toBeCloseTo(expectedTotal, 6);

      console.log(`✅ Bob received: ${TRANSFER_AMOUNT} ${CURRENCY}`);
      console.log(`✅ Alice paid: ${alicePaid} ${CURRENCY} (includes 0.5% fee of ${expectedFee})`);
    }, 30000);
  });

  describe('Phase 4: Issuer operations have no fee', () => {
    it('should not charge fee on Issuer→user mint', async () => {
      console.log('\n==================== PHASE 4: ISSUER OPERATIONS NO FEE ====================');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      const additionalMint = '1000';
      await mintTokens(issuerWallet, aliceWallet, additionalMint);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      const received = Number(aliceBalanceAfter) - Number(aliceBalanceBefore);
      expect(received).toBe(Number(additionalMint));

      console.log(`✅ Issuer→Alice mint: no fee charged (received exactly ${additionalMint})`);
    }, 30000);

    it('should not charge fee on user→Issuer redemption', async () => {
      console.log('🔥 Testing user→Issuer redemption (no fee)...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);
      const redeemAmount = '100';

      const redeemTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: redeemAmount,
        },
      });
      await submitTransaction(client, redeemTx, aliceWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      const spent = Number(aliceBalanceBefore) - Number(aliceBalanceAfter);
      expect(spent).toBe(Number(redeemAmount));

      console.log(`✅ User→Issuer redeem: no fee charged (Alice spent exactly ${redeemAmount})`);
    }, 30000);
  });

  describe('Phase 5: Clear TransferRate', () => {
    it('should clear TransferRate by setting to 0', async () => {
      console.log('\n==================== PHASE 5: CLEAR TRANSFER RATE ====================');

      const clearRateTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        TransferRate: 0,
      });
      await submitTransaction(client, clearRateTx, issuerWallet);

      const accountInfo = await client.request({
        command: 'account_info',
        account: issuerWallet.address,
        ledger_index: 'validated',
      });
      expect(accountInfo.result.account_data.TransferRate ?? 0).toBe(0);

      console.log('✅ TransferRate cleared');
    }, 20000);

    it('should transfer without fee after clearing rate', async () => {
      console.log('💸 Testing transfer without fee...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);
      const amount = '100';

      const payTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: amount,
        },
      });
      await submitTransaction(client, payTx, aliceWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);

      const alicePaid = Number(aliceBalanceBefore) - Number(aliceBalanceAfter);
      const bobReceived = Number(bobBalanceAfter) - Number(bobBalanceBefore);

      expect(alicePaid).toBe(Number(amount));
      expect(bobReceived).toBe(Number(amount));

      console.log(`✅ No fee: Alice paid ${alicePaid}, Bob received ${bobReceived}`);
    }, 30000);
  });
});
