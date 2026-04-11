/**
 * Vitest globalSetup for local standalone rippled.
 *
 * - Waits for the rippled WebSocket port to become reachable
 * - Starts a periodic ledger_accept timer so submitAndWait works normally
 * - Sets XRPL_NETWORK=local for all test workers
 */
import net from 'node:net';
import { Client } from 'xrpl';

const LOCAL_WS_PORT = 6006;
const LOCAL_WS_URL = `ws://localhost:${LOCAL_WS_PORT}`;
const LEDGER_ACCEPT_INTERVAL_MS = 1000;

let client: Client | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(
    `rippled WebSocket did not become reachable on port ${port} within ${timeoutMs / 1000}s.\n` +
      'Start it with: docker compose up -d'
  );
}

async function ledgerAccept(): Promise<void> {
  if (client?.isConnected()) {
    await (client as any).request({ command: 'ledger_accept' });
  }
}

async function startLedgerAcceptTimer(): Promise<void> {
  client = new Client(LOCAL_WS_URL, { timeout: 10_000 });
  await client.connect();

  // Close a few ledgers upfront so the genesis account is visible in validated ledger
  for (let i = 0; i < 3; i++) {
    await ledgerAccept();
  }

  timer = setInterval(async () => {
    try {
      await ledgerAccept();
    } catch {
      // swallow — rippled may be busy
    }
  }, LEDGER_ACCEPT_INTERVAL_MS);
}

export async function setup(): Promise<void> {
  console.log('[local] Waiting for rippled on port 6006...');
  await waitForPort(LOCAL_WS_PORT, 30_000);
  console.log('[local] rippled is reachable');

  process.env.XRPL_NETWORK = 'local';

  await startLedgerAcceptTimer();
  console.log(`[local] ledger_accept timer started (every ${LEDGER_ACCEPT_INTERVAL_MS}ms)`);
}

export async function teardown(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (client?.isConnected()) {
    await client.disconnect();
    client = null;
  }
  console.log('[local] Cleanup complete');
}
