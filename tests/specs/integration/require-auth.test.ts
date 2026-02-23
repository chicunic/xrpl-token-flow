import {
  type AccountLinesTrustline,
  type AccountSet,
  AccountSetAsfFlags,
  type Client,
  type Payment,
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
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

describe('RequireAuth Test', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;
  let charlieWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting RequireAuth Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Setup - Create Issuer, Alice, Bob, Charlie with RequireAuth + DefaultRipple');
    console.log('  Phase 2: Trust Lines with Authorization (authorize Alice & Bob, leave Charlie unauthorized)');
    console.log('  Phase 3: Token Issuance and Transfer (authorized succeed, unauthorized fail)');
    console.log('  Phase 4: Clear RequireAuth — unauthorized trust lines become usable');

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

      const wallets = await setupWallets(4);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;
      charlieWallet = wallets[3]!;

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
      console.log(`✅ Charlie: ${charlieWallet.address}`);
    }, 80000);

    it('should configure issuer account with RequireAuth and DefaultRipple', async () => {
      console.log('🏦 Configuring issuer account with RequireAuth and DefaultRipple flags...');

      const requireAuthTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: AccountSetAsfFlags.asfRequireAuth,
      });
      await submitTransaction(client, requireAuthTx, issuerWallet);

      const defaultRippleTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: AccountSetAsfFlags.asfDefaultRipple,
      });
      await submitTransaction(client, defaultRippleTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfRequireAuth)).toBe(true);
      expect(hasFlag(flags, AccountRootFlags.lsfDefaultRipple)).toBe(true);

      console.log('✅ RequireAuth and DefaultRipple flags enabled on issuer successfully');
    }, 30000);
  });

  describe('Phase 2: Trust Lines with Authorization', () => {
    async function authorizeTrustLine(wallet: Wallet): Promise<void> {
      const authTx: TrustSet = await client.autofill({
        TransactionType: 'TrustSet',
        Account: issuerWallet.address,
        LimitAmount: {
          currency: currencyToHex(CURRENCY),
          issuer: wallet.address,
          value: '0',
        },
        Flags: TrustSetFlags.tfSetfAuth,
      });
      await submitTransaction(client, authTx, issuerWallet);
    }

    it('should create Alice trust line but in unauthorized state', async () => {
      console.log('\n==================== PHASE 2: TRUST LINES WITH AUTHORIZATION ====================');

      await createTrustLine(aliceWallet, issuerWallet);

      const aliceLine = await findTrustLine(aliceWallet, issuerWallet);
      expect(aliceLine).toBeDefined();
      expect(aliceLine?.authorized).toBeFalsy();

      console.log('✅ Trust line created but is unauthorized');
    }, 20000);

    it('should authorize Alice trust line and verify authorization', async () => {
      console.log('🔓 Issuer authorizing Alice trust line...');

      await authorizeTrustLine(aliceWallet);

      // Check from issuer's perspective (authorized flag appears on issuer's side)
      const issuerAccountLines = await client.request({
        command: 'account_lines',
        account: issuerWallet.address,
        peer: aliceWallet.address,
      });
      const issuerLine = issuerAccountLines.result.lines.find(
        (l: AccountLinesTrustline) => l.currency === currencyToHex(CURRENCY) && l.account === aliceWallet.address
      );
      expect(issuerLine?.authorized).toBeTruthy();

      console.log('✅ Alice trust line authorized and verified successfully');
    }, 30000);

    it('should create Bob trust line but in unauthorized state', async () => {
      console.log('⚠️ Bob creating trust line (will be unauthorized due to RequireAuth)...');

      await createTrustLine(bobWallet, issuerWallet);

      const bobLine = await findTrustLine(bobWallet, issuerWallet);
      expect(bobLine).toBeDefined();
      expect(bobLine?.authorized).toBeFalsy();

      console.log('✅ Bob trust line created but is unauthorized');
    }, 20000);

    it('should authorize Bob trust line from issuer', async () => {
      console.log('🔓 Issuer authorizing Bob trust line...');

      await authorizeTrustLine(bobWallet);

      const issuerAccountLines = await client.request({
        command: 'account_lines',
        account: issuerWallet.address,
        peer: bobWallet.address,
      });
      const issuerLine = issuerAccountLines.result.lines.find(
        (l: AccountLinesTrustline) => l.currency === currencyToHex(CURRENCY) && l.account === bobWallet.address
      );
      expect(issuerLine?.authorized).toBeTruthy();

      console.log('✅ Bob trust line authorized successfully');
    }, 30000);

    it('should create Charlie trust line but keep it unauthorized', async () => {
      console.log('⚠️ Charlie creating trust line (will remain unauthorized for testing)...');

      await createTrustLine(charlieWallet, issuerWallet);

      const charlieLine = await findTrustLine(charlieWallet, issuerWallet);
      expect(charlieLine).toBeDefined();
      expect(charlieLine?.authorized).toBeFalsy();

      console.log('✅ Charlie trust line created but remains unauthorized (for testing RequireAuth)');
    }, 20000);
  });

  describe('Phase 3: Token Issuance and Transfer', () => {
    it('should issue USD tokens to Alice', async () => {
      console.log('\n==================== PHASE 3: TOKEN ISSUANCE AND TRANSFER ====================');

      await mintTokens(issuerWallet, aliceWallet, MINT_AMOUNT);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      expect(aliceBalance).toBe(MINT_AMOUNT);

      console.log(`✅ Alice now has ${MINT_AMOUNT} ${CURRENCY}`);
    }, 20000);

    it('should allow Alice to transfer tokens to Bob', async () => {
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

      console.log(
        `✅ Transfer successful: Alice now has ${aliceBalance} ${CURRENCY}, Bob has ${bobBalance} ${CURRENCY}`
      );
    }, 30000);

    it('should fail to issue tokens to unauthorized Charlie', async () => {
      console.log('❌ Attempting to issue tokens to unauthorized Charlie (should fail)...');

      const issueToCharlieTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: charlieWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: MINT_AMOUNT,
        },
      });
      await submitTransaction(client, issueToCharlieTx, issuerWallet, 'tecPATH_DRY');

      console.log('✅ Payment to unauthorized Charlie correctly failed with tecPATH_DRY');
    }, 10000);

    it('should fail Alice transfer to unauthorized Charlie', async () => {
      console.log('❌ Alice attempting to transfer tokens to unauthorized Charlie (should fail)...');

      const transferToCharlieTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: charlieWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, transferToCharlieTx, aliceWallet, 'tecPATH_DRY');

      console.log('✅ Transfer to unauthorized Charlie correctly failed with tecPATH_DRY');
    }, 10000);
  });

  describe('Phase 4: Authorization Limitations', () => {
    it('should successfully clear RequireAuth flag', async () => {
      console.log('\n==================== PHASE 4: AUTHORIZATION LIMITATIONS ====================');

      const clearRequireAuthTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        ClearFlag: AccountSetAsfFlags.asfRequireAuth,
      });
      await submitTransaction(client, clearRequireAuthTx, issuerWallet);

      const flags = await getAccountFlags(client, issuerWallet.address);
      expect(hasFlag(flags, AccountRootFlags.lsfRequireAuth)).toBe(false);

      console.log('✅ RequireAuth flag was successfully cleared');
    }, 20000);

    it('should allow issuing tokens to Charlie after clearing RequireAuth', async () => {
      console.log('✅ Testing token issuance to Charlie after clearing RequireAuth...');

      await mintTokens(issuerWallet, charlieWallet, MINT_AMOUNT);

      const charlieBalance = await getTokenBalance(charlieWallet, issuerWallet);
      expect(charlieBalance).toBe(MINT_AMOUNT);

      console.log(`✅ Charlie now has ${charlieBalance} ${CURRENCY}`);
    }, 20000);

    it('should allow Alice to transfer tokens to Charlie after clearing RequireAuth', async () => {
      console.log('✅ Testing Alice -> Charlie transfer after clearing RequireAuth...');

      const charlieBalanceBefore = await getTokenBalance(charlieWallet, issuerWallet);

      const transferToCharlieTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: aliceWallet.address,
        Destination: charlieWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, transferToCharlieTx, aliceWallet);

      const charlieBalanceAfter = await getTokenBalance(charlieWallet, issuerWallet);
      expect(BigInt(charlieBalanceAfter)).toEqual(BigInt(charlieBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(
        `✅ Transfer successful: Charlie balance ${charlieBalanceBefore} -> ${charlieBalanceAfter} ${CURRENCY}`
      );
      console.log('ℹ️ This demonstrates that clearing RequireAuth immediately makes unauthorized trust lines usable');
    }, 30000);
  });
});
