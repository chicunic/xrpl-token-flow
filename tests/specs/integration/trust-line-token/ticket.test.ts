import { MINT_AMOUNT } from "@tests/utils/data.js";
import { createTrustLine, getTokenBalance, setupWallets } from "@tests/utils/test.helper.js";
import { createTickets, getAvailableTickets } from "@/services/ticket.service.js";
import { submitTransaction } from "@/services/transaction.service.js";
import type { Client, Payment, Wallet } from "xrpl";
import { getXRPLClient, initializeXRPLClient } from "@/config/xrpl.config.js";

/**
 * Advanced XRPL: Tickets (Presigned / Out-of-Order Execution)
 *
 * Demonstrates:
 * 1. Allocating Tickets for the Issuer.
 * 2. Fetching available Ticket Sequences.
 * 3. Constructing transactions and binding them to specific Tickets (Sequence = 0, TicketSequence = X).
 * 4. Submitting the transactions entirely OUT OF ORDER to prove they bypass normal Sequence constraints.
 */
describe("Trust Line Token - Tickets (Out-of-Order Execution)", () => {
  let client: Client;

  let issuerWallet: Wallet;
  let aliceWallet: Wallet;
  let bobWallet: Wallet;

  beforeAll(async () => {
    console.log("🚀 Starting Trust Line Ticket Test");
    await initializeXRPLClient();
    client = getXRPLClient();
  }, 30000);

  afterAll(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  it("should setup and fund wallets", async () => {
    const wallets = await setupWallets(3);
    issuerWallet = wallets[0]!;
    aliceWallet = wallets[1]!;
    bobWallet = wallets[2]!;

    // Setup trust lines so Issuer can mint to Alice and Bob
    await createTrustLine(aliceWallet, issuerWallet);
    await createTrustLine(bobWallet, issuerWallet);
  }, 60000);

  it("should create 2 tickets for the issuer", async () => {
    const firstTicket = await createTickets(issuerWallet, 2);
    console.log(`✅ Created 2 tickets starting at sequence: ${firstTicket}`);

    const available = await getAvailableTickets(issuerWallet.address);
    expect(available.length).toBeGreaterThanOrEqual(2);
    expect(available.includes(firstTicket)).toBe(true);
    expect(available.includes(firstTicket + 1)).toBe(true);
  }, 30000);

  it("should execute Mint transactions OUT OF ORDER using Tickets", async () => {
    const available = await getAvailableTickets(issuerWallet.address);
    const ticket1 = available[0]!;
    const ticket2 = available[1]!;

    // We pre-construct two minting transactions.
    // Crucial steps for using a Ticket:
    // 1. Sequence MUST be set to 0.
    // 2. TicketSequence MUST be set to the assigned ticket.

    // TX A: Mint to Alice (bound to Ticket 1)
    const txA: Payment = await client.autofill({
      TransactionType: "Payment",
      Account: issuerWallet.address,
      Destination: aliceWallet.address,
      Sequence: 0,
      TicketSequence: ticket1,
      Amount: {
        currency: "USD",
        issuer: issuerWallet.address,
        value: MINT_AMOUNT,
      },
    });

    // TX B: Mint to Bob (bound to Ticket 2)
    const txB: Payment = await client.autofill({
      TransactionType: "Payment",
      Account: issuerWallet.address,
      Destination: bobWallet.address,
      Sequence: 0,
      TicketSequence: ticket2,
      Amount: {
        currency: "USD",
        issuer: issuerWallet.address,
        value: MINT_AMOUNT,
      },
    });

    // We can now sign these anytime, offline, or heavily out of order!
    // SUBMIT TX B FIRST (which uses a higher ticket sequence)
    console.log(`🔄 Submitting Tx B (Ticket ${ticket2}) BEFORE Tx A...`);
    await submitTransaction(client, txB, issuerWallet);
    const bobBalance = await getTokenBalance(bobWallet, issuerWallet);
    expect(bobBalance).toBe(MINT_AMOUNT);

    // SUBMIT TX A SECOND (which uses the lower ticket sequence)
    console.log(`🔄 Submitting Tx A (Ticket ${ticket1}) AFTER Tx B...`);
    await submitTransaction(client, txA, issuerWallet);
    const aliceBalance = await getTokenBalance(aliceWallet, issuerWallet);
    expect(aliceBalance).toBe(MINT_AMOUNT);

    console.log("✅ Successfully executed transactions out of order using Tickets!");
  }, 30000);

  describe("Edge Cases", () => {
    it("should FAIL to create more than 250 tickets at once", async () => {
      try {
        await createTickets(issuerWallet, 251);
        throw new Error("Expected to fail when creating > 250 tickets");
      } catch (error: any) {
        expect(error.message).toMatch(/temBAD_TICKET_COUNT|TicketCount must be an integer/);
      }
    }, 30000);

    it("should FAIL to reuse an already consumed Ticket", async () => {
      // Grab a new ticket
      const ticketSeq = await createTickets(issuerWallet, 1);

      // Tx 1: Consume it successfully
      const tx1: Payment = await client.autofill({
        TransactionType: "Payment",
        Account: issuerWallet.address,
        Destination: aliceWallet.address,
        Sequence: 0,
        TicketSequence: ticketSeq,
        Amount: {
          currency: "USD",
          issuer: issuerWallet.address,
          value: MINT_AMOUNT,
        },
      });
      await submitTransaction(client, tx1, issuerWallet);

      // Tx 2: Try to consume the exact same ticket again
      const tx2: Payment = await client.autofill({
        TransactionType: "Payment",
        Account: issuerWallet.address,
        Destination: aliceWallet.address,
        Sequence: 0,
        TicketSequence: ticketSeq,
        Amount: {
          currency: "USD",
          issuer: issuerWallet.address,
          value: MINT_AMOUNT,
        },
      });

      try {
        await submitTransaction(client, tx2, issuerWallet);
        throw new Error("Expected transaction to fail because ticket was already consumed");
      } catch (error: any) {
        expect(error.message).toContain("tefNO_TICKET");
      }
    }, 30000);
  });
});
