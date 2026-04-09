import { CURRENCY, MINT_AMOUNT, TRANSFER_AMOUNT } from '@tests/utils/data';
import { createTrustLine, findTrustLine, getTokenBalance, mintTokens, setupWallets } from '@tests/utils/test.helper';
import {
  authorizeTrustLine,
  clearAccountFlag,
  setAccountFlag,
  transferTokens,
  verifyAccountFlag,
} from '@tests/utils/trust-line-token.helper';
import type { Client, Wallet } from 'xrpl';
import { AccountSetAsfFlags } from 'xrpl';
import { AccountRootFlags } from 'xrpl/dist/npm/models/ledger';
import { getXRPLClient, initializeXRPLClient } from '@/config/xrpl.config';

/**
 * RequireAuth Test
 *
 * Tests trust line authorization behavior:
 *   Phase 1: Setup - Create Issuer, Alice, Bob, Charlie with RequireAuth + DefaultRipple
 *   Phase 2: Trust Lines with Authorization (authorize Alice & Bob, leave Charlie unauthorized)
 *   Phase 3: Token Issuance and Transfer (authorized succeed, unauthorized fail)
 *   Phase 4: Clear RequireAuth -- unauthorized trust lines become usable
 */
describe('Trust Line Token RequireAuth', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;
  let charlieWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting RequireAuth Test');

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
      await setAccountFlag(issuerWallet, AccountSetAsfFlags.asfRequireAuth);
      await setAccountFlag(issuerWallet, AccountSetAsfFlags.asfDefaultRipple);

      await verifyAccountFlag(issuerWallet.address, AccountRootFlags.lsfRequireAuth, true);
      await verifyAccountFlag(issuerWallet.address, AccountRootFlags.lsfDefaultRipple, true);

      console.log('✅ RequireAuth and DefaultRipple flags enabled on issuer successfully');
    }, 30000);
  });

  describe('Phase 2: Trust Lines with Authorization', () => {
    it('should create Alice trust line but in unauthorized state', async () => {
      console.log('\n==================== PHASE 2: TRUST LINES WITH AUTHORIZATION ====================');

      await createTrustLine(aliceWallet, issuerWallet);

      const aliceLine = await findTrustLine(aliceWallet, issuerWallet);
      expect(aliceLine).toBeDefined();
      expect(aliceLine?.authorized).toBeFalsy();

      console.log('✅ Trust line created but is unauthorized');
    }, 20000);

    it('should authorize Alice trust line and verify authorization', async () => {
      await authorizeTrustLine(issuerWallet, aliceWallet);

      // Check from issuer's perspective (authorized flag appears on issuer's side)
      const issuerAccountLines = await client.request({
        command: 'account_lines',
        account: issuerWallet.address,
        peer: aliceWallet.address,
      });
      const issuerLine = issuerAccountLines.result.lines.find(l => l.account === aliceWallet.address);
      expect(issuerLine?.authorized).toBeTruthy();

      console.log('✅ Alice trust line authorized and verified successfully');
    }, 30000);

    it('should create Bob trust line but in unauthorized state', async () => {
      await createTrustLine(bobWallet, issuerWallet);

      const bobLine = await findTrustLine(bobWallet, issuerWallet);
      expect(bobLine).toBeDefined();
      expect(bobLine?.authorized).toBeFalsy();

      console.log('✅ Bob trust line created but is unauthorized');
    }, 20000);

    it('should authorize Bob trust line from issuer', async () => {
      await authorizeTrustLine(issuerWallet, bobWallet);

      const issuerAccountLines = await client.request({
        command: 'account_lines',
        account: issuerWallet.address,
        peer: bobWallet.address,
      });
      const issuerLine = issuerAccountLines.result.lines.find(l => l.account === bobWallet.address);
      expect(issuerLine?.authorized).toBeTruthy();

      console.log('✅ Bob trust line authorized successfully');
    }, 30000);

    it('should create Charlie trust line but keep it unauthorized', async () => {
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
      await transferTokens(aliceWallet, bobWallet, TRANSFER_AMOUNT, issuerWallet);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalance = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(aliceBalance)).toEqual(BigInt(MINT_AMOUNT) - BigInt(TRANSFER_AMOUNT));
      expect(BigInt(bobBalance)).toEqual(BigInt(TRANSFER_AMOUNT));

      console.log(
        `✅ Transfer successful: Alice now has ${aliceBalance} ${CURRENCY}, Bob has ${bobBalance} ${CURRENCY}`
      );
    }, 30000);

    it('should fail to issue tokens to unauthorized Charlie', async () => {
      await transferTokens(issuerWallet, charlieWallet, MINT_AMOUNT, issuerWallet, 'tecPATH_DRY');

      console.log('✅ Payment to unauthorized Charlie correctly failed with tecPATH_DRY');
    }, 10000);

    it('should fail Alice transfer to unauthorized Charlie', async () => {
      await transferTokens(aliceWallet, charlieWallet, TRANSFER_AMOUNT, issuerWallet, 'tecPATH_DRY');

      console.log('✅ Transfer to unauthorized Charlie correctly failed with tecPATH_DRY');
    }, 10000);
  });

  describe('Phase 4: Authorization Limitations', () => {
    it('should successfully clear RequireAuth flag', async () => {
      console.log('\n==================== PHASE 4: AUTHORIZATION LIMITATIONS ====================');

      await clearAccountFlag(issuerWallet, AccountSetAsfFlags.asfRequireAuth);

      await verifyAccountFlag(issuerWallet.address, AccountRootFlags.lsfRequireAuth, false);

      console.log('✅ RequireAuth flag was successfully cleared');
    }, 20000);

    it('should allow issuing tokens to Charlie after clearing RequireAuth', async () => {
      await mintTokens(issuerWallet, charlieWallet, MINT_AMOUNT);

      const charlieBalance = await getTokenBalance(charlieWallet, issuerWallet);
      expect(charlieBalance).toBe(MINT_AMOUNT);

      console.log(`✅ Charlie now has ${charlieBalance} ${CURRENCY}`);
    }, 20000);

    it('should allow Alice to transfer tokens to Charlie after clearing RequireAuth', async () => {
      const charlieBalanceBefore = await getTokenBalance(charlieWallet, issuerWallet);

      await transferTokens(aliceWallet, charlieWallet, TRANSFER_AMOUNT, issuerWallet);

      const charlieBalanceAfter = await getTokenBalance(charlieWallet, issuerWallet);
      expect(BigInt(charlieBalanceAfter)).toEqual(BigInt(charlieBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(
        `✅ Transfer successful: Charlie balance ${charlieBalanceBefore} -> ${charlieBalanceAfter} ${CURRENCY}`
      );
    }, 30000);
  });
});
