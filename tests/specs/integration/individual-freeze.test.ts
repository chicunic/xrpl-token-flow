import {
  type AccountSet,
  AccountSetAsfFlags,
  type Client,
  type Payment,
  type TransactionMetadata,
  type TrustSet,
  TrustSetFlags,
  type Wallet,
} from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT } from '../../utils/data';
import {
  createTrustLine,
  currencyToHex,
  findTrustLine,
  getAccountFlags,
  getTokenBalance,
  hasFlag,
  mintTokens,
  setupIssuerWithFlags,
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

describe('Individual Freeze Test', () => {
  let client: Client;
  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting Individual Freeze Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer, Alice, Bob, trust lines, mint tokens');
    console.log('  Phase 2: Issuer freezes Alice trust line (TrustSet + tfSetFreeze)');
    console.log('  Phase 3: Alice transfer fails, Bob unaffected, Issuer can still operate');
    console.log('  Phase 4: Unfreeze Alice (tfClearFreeze), verify transfer restored');
    console.log('  Phase 5: Set asfNoFreeze — verify issuer can never freeze again (permanent)');
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

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalance = await getTokenBalance(bobWallet, issuerWallet);
      expect(aliceBalance).toBe(MINT_AMOUNT);
      expect(bobBalance).toBe(MINT_AMOUNT);

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address} (${aliceBalance} ${CURRENCY})`);
      console.log(`✅ Bob: ${bobWallet.address} (${bobBalance} ${CURRENCY})`);
    }, 120000);
  });

  describe('Phase 2: Freeze Alice trust line', () => {
    it('should freeze Alice trust line via TrustSet + tfSetFreeze', async () => {
      console.log('\n==================== PHASE 2: FREEZE ALICE TRUST LINE ====================');

      const freezeTx: TrustSet = await client.autofill({
        TransactionType: 'TrustSet',
        Account: issuerWallet.address,
        LimitAmount: {
          currency: currencyToHex(CURRENCY),
          issuer: aliceWallet.address,
          value: '0',
        },
        Flags: TrustSetFlags.tfSetFreeze,
      });
      await submitTransaction(client, freezeTx, issuerWallet);

      const aliceLine = await findTrustLine(aliceWallet, issuerWallet);
      expect(aliceLine).toBeDefined();
      expect(aliceLine?.freeze_peer).toBe(true);

      console.log('✅ Alice trust line frozen successfully');
    }, 30000);
  });

  describe('Phase 3: Verify freeze effects', () => {
    it('should fail Alice→Bob transfer while frozen', async () => {
      console.log('\n==================== PHASE 3: VERIFY FREEZE EFFECTS ====================');
      console.log('🙅 Testing Alice→Bob transfer while frozen...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const payTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, payTx, aliceWallet, 'tecPATH_DRY');

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(bobBalanceAfter).toBe(bobBalanceBefore);

      console.log('✅ Alice→Bob transfer correctly failed (frozen)');
    }, 30000);

    it('should allow Bob→Alice transfer while Alice is frozen (freeze only blocks outgoing)', async () => {
      console.log('💸 Testing Bob→Alice transfer while Alice is frozen...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);

      const payTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: aliceWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, payTx, bobWallet);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(Number(aliceBalanceAfter) - Number(aliceBalanceBefore)).toBe(Number(TRANSFER_AMOUNT));

      console.log(`✅ Bob→Alice transfer succeeded (freeze only blocks outgoing): +${TRANSFER_AMOUNT} ${CURRENCY}`);
    }, 30000);

    it('should allow Bob→Bob2 style transfer (Bob is NOT frozen)', async () => {
      console.log('✅ Testing Bob is unaffected (not frozen)...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);
      const redeemAmount = '100';

      const redeemTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: redeemAmount,
        },
      });
      await submitTransaction(client, redeemTx, bobWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(Number(bobBalanceBefore) - Number(bobBalanceAfter)).toBe(Number(redeemAmount));

      console.log(`✅ Bob can still redeem to issuer (not frozen): -${redeemAmount} ${CURRENCY}`);
    }, 30000);

    it('should allow Issuer to mint to frozen Alice', async () => {
      console.log('💰 Testing Issuer can still mint to frozen Alice...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);
      const mintAmount = '500';

      await mintTokens(issuerWallet, aliceWallet, mintAmount);

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      expect(Number(aliceBalanceAfter) - Number(aliceBalanceBefore)).toBe(Number(mintAmount));

      console.log(`✅ Issuer minted ${mintAmount} ${CURRENCY} to frozen Alice`);
    }, 30000);
  });

  describe('Phase 4: Unfreeze Alice', () => {
    it('should unfreeze Alice trust line via tfClearFreeze', async () => {
      console.log('\n==================== PHASE 4: UNFREEZE ALICE ====================');

      const unfreezeTx: TrustSet = await client.autofill({
        TransactionType: 'TrustSet',
        Account: issuerWallet.address,
        LimitAmount: {
          currency: currencyToHex(CURRENCY),
          issuer: aliceWallet.address,
          value: '0',
        },
        Flags: TrustSetFlags.tfClearFreeze,
      });
      await submitTransaction(client, unfreezeTx, issuerWallet);

      const aliceLine = await findTrustLine(aliceWallet, issuerWallet);
      expect(aliceLine).toBeDefined();
      expect(aliceLine?.freeze_peer).toBeFalsy();

      console.log('✅ Alice trust line unfrozen');
    }, 30000);

    it('should succeed Alice→Bob transfer after unfreeze', async () => {
      console.log('💸 Testing Alice→Bob transfer after unfreeze...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);

      const payTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: bobWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, payTx, aliceWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(Number(bobBalanceAfter) - Number(bobBalanceBefore)).toBe(Number(TRANSFER_AMOUNT));

      console.log(`✅ Alice→Bob transfer restored: +${TRANSFER_AMOUNT} ${CURRENCY}`);
    }, 30000);
  });

  describe('Phase 5: asfNoFreeze (permanent)', () => {
    it('should set asfNoFreeze flag', async () => {
      console.log('\n==================== PHASE 5: asfNoFreeze (PERMANENT) ====================');

      const noFreezeTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: AccountSetAsfFlags.asfNoFreeze,
      });
      await submitTransaction(client, noFreezeTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfNoFreeze)).toBe(true);

      console.log('✅ asfNoFreeze flag set (permanent)');
    }, 20000);

    it('should fail to freeze any trust line after asfNoFreeze', async () => {
      console.log('🙅 Attempting to freeze Bob trust line after asfNoFreeze...');

      const freezeAttemptTx: TrustSet = await client.autofill({
        TransactionType: 'TrustSet',
        Account: issuerWallet.address,
        LimitAmount: {
          currency: currencyToHex(CURRENCY),
          issuer: bobWallet.address,
          value: '0',
        },
        Flags: TrustSetFlags.tfSetFreeze,
      });
      await submitTransaction(client, freezeAttemptTx, issuerWallet, 'tecNO_PERMISSION');

      console.log('✅ Freeze attempt correctly rejected after asfNoFreeze');
    }, 30000);

    it('should not be able to clear asfNoFreeze (permanent)', async () => {
      console.log('🔒 Verifying asfNoFreeze cannot be cleared...');

      const clearNoFreezeTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        ClearFlag: AccountSetAsfFlags.asfNoFreeze,
      });

      const signed = issuerWallet.sign(clearNoFreezeTx);
      const result = await client.submitAndWait(signed.tx_blob);
      const txResult = (result.result.meta as TransactionMetadata)?.TransactionResult;
      // Flag stays set either way
      expect(['tesSUCCESS', 'tecNO_PERMISSION']).toContain(txResult);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfNoFreeze)).toBe(true);

      console.log('✅ asfNoFreeze flag remains set (permanent, cannot be cleared)');
    }, 20000);
  });
});
