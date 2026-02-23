import { type Client, convertStringToHex, type Payment, type TransactionMetadata, type Wallet } from 'xrpl';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, MEMO_DATA, MEMO_TYPE, MINT_AMOUNT, TRANSFER_AMOUNT, TRUST_AMOUNT } from '../../utils/data';
import {
  createTrustLine,
  currencyToHex,
  findTrustLine,
  getTokenBalance,
  mintTokens,
  setupIssuerWithFlags,
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

describe('Edge Cases Test', () => {
  let client: Client;
  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting Edge Cases Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create wallets, trust lines, mint tokens');
    console.log('  Phase 2: Self-payment → temREDUNDANT');
    console.log('  Phase 3: Zero amount → temBAD_AMOUNT');
    console.log('  Phase 4: Over-limit → tecPATH_PARTIAL');
    console.log('  Phase 5: Memo (MemoType + MemoData)');
    console.log('  Phase 6: Trust line deletion (limit=0, balance=0)');
    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Setup', () => {
    it('should create wallets, trust lines, and mint tokens', async () => {
      console.log('\n==================== PHASE 1: SETUP ====================');

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      await setupIssuerWithFlags(issuerWallet);

      await createTrustLine(aliceWallet, issuerWallet);
      await createTrustLine(bobWallet, issuerWallet);

      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);
      await mintTokens(issuerWallet, bobWallet, MINT_AMOUNT);

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address} (${MINT_AMOUNT} ${CURRENCY})`);
      console.log(`✅ Bob: ${bobWallet.address} (${MINT_AMOUNT} ${CURRENCY})`);
    }, 120000);
  });

  describe('Phase 2: Self-payment', () => {
    it('should reject self-payment with temREDUNDANT', async () => {
      console.log('\n==================== PHASE 2: SELF-PAYMENT ====================');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      const selfPayTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: aliceWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });

      const signed = aliceWallet.sign(selfPayTx);

      // tem* errors are preflight failures that throw before reaching the ledger
      await expect(client.submitAndWait(signed.tx_blob)).rejects.toThrow('temREDUNDANT');

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(aliceBalanceAfter).toBe(aliceBalanceBefore);

      console.log('✅ Self-payment correctly rejected: temREDUNDANT');
    }, 30000);
  });

  describe('Phase 3: Zero amount', () => {
    it('should reject zero-amount payment with temBAD_AMOUNT', async () => {
      console.log('\n==================== PHASE 3: ZERO AMOUNT ====================');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const zeroPayTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: '0',
        },
      });

      const signed = aliceWallet.sign(zeroPayTx);

      await expect(client.submitAndWait(signed.tx_blob)).rejects.toThrow('temBAD_AMOUNT');

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(aliceBalanceAfter).toBe(aliceBalanceBefore);
      expect(bobBalanceAfter).toBe(bobBalanceBefore);

      console.log('✅ Zero amount payment correctly rejected: temBAD_AMOUNT');
    }, 30000);
  });

  describe('Phase 4: Over-limit payment', () => {
    it('should fail payment that would exceed trust line limit', async () => {
      console.log('\n==================== PHASE 4: OVER-LIMIT PAYMENT ====================');

      const overLimitAmount = String(Number(TRUST_AMOUNT) + 1);

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      // Issuer tries to mint over-limit to Bob
      const overLimitTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: overLimitAmount,
        },
      });

      const txResult = await submitTransaction(client, overLimitTx, issuerWallet, 'tecPATH_PARTIAL');

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(bobBalanceAfter).toBe(bobBalanceBefore);

      console.log(`✅ Over-limit payment correctly rejected: ${txResult}`);
    }, 30000);
  });

  describe('Phase 5: Memo', () => {
    it('should submit and read a transaction with MemoType + MemoData', async () => {
      console.log('\n==================== PHASE 5: MEMO ====================');

      const payTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
        Memos: [
          {
            Memo: {
              MemoType: convertStringToHex(MEMO_TYPE),
              MemoData: convertStringToHex(MEMO_DATA),
            },
          },
        ],
      });

      const signed = aliceWallet.sign(payTx);
      const result = await client.submitAndWait(signed.tx_blob);
      expect((result.result.meta as TransactionMetadata)?.TransactionResult).toBe('tesSUCCESS');

      const txResponse = await client.request({
        command: 'tx',
        transaction: result.result.hash,
      });

      const txJson = txResponse.result.tx_json as Record<string, any>;
      const memos = txJson.Memos as Array<{ Memo: { MemoType: string; MemoData: string } }>;
      expect(memos).toBeDefined();
      expect(memos.length).toBe(1);
      expect(memos[0]?.Memo.MemoType).toBe(convertStringToHex(MEMO_TYPE));
      expect(memos[0]?.Memo.MemoData).toBe(convertStringToHex(MEMO_DATA));

      console.log(`✅ Memo attached and verified: MemoType=${MEMO_TYPE}, MemoData=${MEMO_DATA}`);
    }, 30000);
  });

  describe('Phase 6: Trust line deletion', () => {
    it('should zero out trust line when limit set to 0 and balance is 0', async () => {
      console.log('\n==================== PHASE 6: TRUST LINE DELETION ====================');

      const wallets = await setupWallets(1);
      const carolWallet = wallets[0]!;

      await createTrustLine(carolWallet, issuerWallet);

      const smallAmount = '100';
      await mintTokens(issuerWallet, carolWallet, smallAmount);

      const redeemTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: carolWallet.address,
        Destination: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: smallAmount,
        },
      });
      await submitTransaction(client, redeemTx, carolWallet);

      const balanceAfterRedeem = await getTokenBalance(carolWallet, issuerWallet);
      expect(balanceAfterRedeem).toBe('0');

      const deleteTrustTx = await client.autofill({
        TransactionType: 'TrustSet' as const,
        Account: carolWallet.address,
        LimitAmount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: '0',
        },
      });
      await submitTransaction(client, deleteTrustTx, carolWallet);

      // Trust line may persist due to ripple state flags (expected XRPL behavior)
      const remainingLine = await findTrustLine(carolWallet, issuerWallet);

      if (remainingLine) {
        // Trust line persists but is zeroed out
        expect(remainingLine.balance).toBe('0');
        expect(remainingLine.limit).toBe('0');
        console.log('✅ Trust line zeroed out (limit=0, balance=0, persists due to ripple state flags)');
      } else {
        // Trust line was fully deleted
        console.log('✅ Trust line fully deleted (limit=0, balance=0)');
      }
    }, 120000);
  });
});
