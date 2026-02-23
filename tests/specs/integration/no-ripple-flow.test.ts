import {
  type AccountLinesTrustline,
  type AccountSet,
  AccountSetAsfFlags,
  type Client,
  convertStringToHex,
  type Payment,
  type TrustSet,
  TrustSetFlags,
  type Wallet,
} from 'xrpl';

import { getXRPLClient, initializeXRPLClient } from '../../../src/config/xrpl.config';
import { CURRENCY, DOMAIN, TRANSFER_AMOUNT } from '../../utils/data';
import {
  createTrustLine,
  currencyToHex,
  findTrustLine,
  getTokenBalance,
  mintTokens,
  setupWallets,
  submitTransaction,
} from '../../utils/test.helper';

describe('XRPL No Ripple Flow Test', () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log('🚀 Starting XRPL No Ripple Flow Test');
    console.log('Test Flow:');
    console.log('  Phase 1: Create and Fund Accounts, configure issuer WITHOUT DefaultRipple');
    console.log('  Phase 2: Setup Trust Lines (NoRipple set by default), clear NoRipple on Bob');
    console.log('  Phase 3: Token Minting and Transfer Flow');

    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Disconnected from XRPL');
    }
  });

  describe('Phase 1: Create and Fund Accounts', () => {
    it('should create and fund all wallets', async () => {
      console.log('\n==================== PHASE 1: CREATE AND FUND ACCOUNTS ====================');

      const wallets = await setupWallets(3);
      issuerWallet = wallets[0]!;
      aliceWallet = wallets[1]!;
      bobWallet = wallets[2]!;

      console.log(`✅ Issuer: ${issuerWallet.address}`);
      console.log(`✅ Alice: ${aliceWallet.address}`);
      console.log(`✅ Bob: ${bobWallet.address}`);
    }, 60000);

    it('should configure issuer WITHOUT DefaultRipple', async () => {
      console.log('⚙️ Setting up issuer account WITHOUT DefaultRipple...');

      const clawbackTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        Domain: convertStringToHex(DOMAIN),
        SetFlag: AccountSetAsfFlags.asfAllowTrustLineClawback,
      });
      await submitTransaction(client, clawbackTx, issuerWallet);
      console.log('✅ Flag AllowTrustLineClawback set');

      const disallowXRPTx: AccountSet = await client.autofill({
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: AccountSetAsfFlags.asfDisallowXRP,
      });
      await submitTransaction(client, disallowXRPTx, issuerWallet);
      console.log('✅ Flag DisallowXRP set');

      console.log('✅ Issuer configured WITHOUT DefaultRipple flag');
    }, 20000);
  });

  describe('Phase 2: Setup Trust Lines', () => {
    it('should create Alice trust line to Issuer', async () => {
      console.log('\n==================== PHASE 2: SETUP TRUST LINES ====================');

      await createTrustLine(aliceWallet, issuerWallet);

      const aliceLine = await findTrustLine(aliceWallet, issuerWallet);
      expect(aliceLine).toBeDefined();
      expect(aliceLine?.balance).toBe('0');
      expect(aliceLine?.no_ripple).toBeFalsy();
      expect(aliceLine?.no_ripple_peer).toBeTruthy(); // Without DefaultRipple, NoRipple is set by default

      console.log(`✅ Alice trusts Issuer for ${CURRENCY}`);
    }, 20000);

    it('should create Bob trust line to Issuer', async () => {
      console.log('🔗 Bob creating trust line to Issuer...');

      await createTrustLine(bobWallet, issuerWallet);

      const bobLine = await findTrustLine(bobWallet, issuerWallet);
      expect(bobLine).toBeDefined();
      expect(bobLine?.balance).toBe('0');
      expect(bobLine?.no_ripple).toBeFalsy();
      expect(bobLine?.no_ripple_peer).toBeTruthy(); // Without DefaultRipple, NoRipple is set by default

      console.log(`✅ Bob trusts Issuer for ${CURRENCY}`);
    }, 20000);

    it('should clear NoRipple flag on Bob trust line from Issuer side', async () => {
      console.log('🔒 Issuer clearing NoRipple flag on Bob trust line...');

      const issuerTrustTx: TrustSet = await client.autofill({
        TransactionType: 'TrustSet',
        Account: issuerWallet.address,
        LimitAmount: {
          currency: currencyToHex(CURRENCY),
          issuer: bobWallet.address,
          value: '0',
        },
        Flags: TrustSetFlags.tfClearNoRipple,
      });
      await submitTransaction(client, issuerTrustTx, issuerWallet);

      // Verify from issuer's perspective
      const issuerAccountLines = await client.request({
        command: 'account_lines',
        account: issuerWallet.address,
        peer: bobWallet.address,
      });
      const issuerLine = issuerAccountLines.result.lines.find(
        (l: AccountLinesTrustline) => l.currency === currencyToHex(CURRENCY) && l.account === bobWallet.address
      );
      expect(issuerLine).toBeDefined();
      expect(issuerLine?.no_ripple).toBeFalsy();
      expect(issuerLine?.no_ripple_peer).toBeFalsy();

      console.log('✅ NoRipple flag cleared on Issuer -> Bob trust line');
    }, 20000);
  });

  describe('Phase 3: Token Minting and Transfer', () => {
    it('should mint USD tokens from Issuer to Alice', async () => {
      console.log('\n==================== PHASE 3: TOKEN MINTING AND TRANSFER ====================');

      await mintTokens(issuerWallet, aliceWallet, TRANSFER_AMOUNT);

      const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
      expect(aliceBalance).toBe(TRANSFER_AMOUNT);

      console.log(`✅ Alice now has ${TRANSFER_AMOUNT} ${CURRENCY}`);
    }, 20000);

    it('should transfer USD from Alice to Bob', async () => {
      console.log('💸 Transferring USD from Alice to Bob...');

      const aliceBalanceBefore = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);
      console.log(
        `💰 Before Transfer - Alice: ${aliceBalanceBefore} ${CURRENCY}, Bob: ${bobBalanceBefore} ${CURRENCY}`
      );

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

      const aliceBalanceAfter = await getTokenBalance(aliceWallet, issuerWallet);
      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(aliceBalanceAfter)).toEqual(BigInt(aliceBalanceBefore) - BigInt(TRANSFER_AMOUNT));
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) + BigInt(TRANSFER_AMOUNT));

      console.log(`💰 After Transfer - Alice: ${aliceBalanceAfter} ${CURRENCY}, Bob: ${bobBalanceAfter} ${CURRENCY}`);
      console.log(`✅ Alice transferred ${TRANSFER_AMOUNT} ${CURRENCY} to Bob`);
    }, 50000);

    it('should burn tokens by transferring from Bob back to Issuer', async () => {
      console.log('🔥 Burning tokens by transferring from Bob to Issuer...');

      const bobBalanceBefore = await getTokenBalance(bobWallet, issuerWallet);
      console.log(`💰 Before Burn - Bob has: ${bobBalanceBefore} ${CURRENCY}`);

      const burnTx: Payment = await client.autofill({
        TransactionType: 'Payment',
        Account: bobWallet.address,
        Destination: issuerWallet.address,
        Amount: {
          currency: currencyToHex(CURRENCY),
          issuer: issuerWallet.address,
          value: TRANSFER_AMOUNT,
        },
      });
      await submitTransaction(client, burnTx, bobWallet);

      const bobBalanceAfter = await getTokenBalance(bobWallet, issuerWallet);
      expect(BigInt(bobBalanceAfter)).toEqual(BigInt(bobBalanceBefore) - BigInt(TRANSFER_AMOUNT));

      console.log(`💰 After Burn - Bob has: ${bobBalanceAfter} ${CURRENCY}`);
      console.log(`✅ Bob burned ${TRANSFER_AMOUNT} ${CURRENCY} by sending back to Issuer`);
      console.log('🏁 Test flow completed successfully!');
    }, 30000);
  });
});
