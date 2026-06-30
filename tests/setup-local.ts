/**
 * Vitest globalSetup for local standalone rippled.
 *
 * Container lifecycle is managed here, not by the developer:
 *   - If the Docker daemon is not running, fail fast with a clear message (start it manually — e.g. Docker Desktop).
 *   - If the rippled container is already up (port reachable), reuse it and leave it running on teardown.
 *   - Otherwise start it via `docker compose up -d`, wait until healthy, and tear it down again after the run.
 *
 * Once connected it also starts a periodic ledger_accept timer so submitAndWait works normally, and sets
 * XRPL_NETWORK=local for all test workers.
 */
import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";
import { Client } from "xrpl";

const execFileAsync = promisify(execFile);

const LOCAL_WS_PORT = 6006;
const LOCAL_WS_URL = `ws://localhost:${LOCAL_WS_PORT}`;
const LEDGER_ACCEPT_INTERVAL_MS = 500;
const PORT_READY_TIMEOUT_MS = 60_000;

let client: Client | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
// True only when this setup started the container, so teardown knows whether to stop it.
let startedByUs = false;

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`rippled WebSocket did not become reachable on port ${port} within ${timeoutMs / 1000}s.`);
}

// Returns true if the Docker daemon is reachable. Does not throw.
async function isDockerDaemonRunning(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["info"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

async function composeUp(): Promise<void> {
  await execFileAsync("docker", ["compose", "up", "-d", "--wait"], { timeout: 180_000 });
}

async function composeDown(): Promise<void> {
  await execFileAsync("docker", ["compose", "down"], { timeout: 60_000 });
}

async function ledgerAccept(): Promise<void> {
  if (client?.isConnected()) {
    await (client as any).request({ command: "ledger_accept" });
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
  // If rippled is already reachable, reuse the running container as-is.
  if (await isPortOpen(LOCAL_WS_PORT)) {
    console.log("[local] rippled already running on port 6006 — reusing it");
  } else {
    // Not running yet: we need Docker to start it. Bail out clearly if the daemon is down.
    if (!(await isDockerDaemonRunning())) {
      throw new Error(
        "Docker daemon is not running. Start Docker (e.g. open Docker Desktop) and retry.\n" +
          "Local rippled tests cannot run without it.",
      );
    }

    console.log("[local] Starting rippled via docker compose...");
    await composeUp();
    startedByUs = true;

    console.log("[local] Waiting for rippled on port 6006...");
    await waitForPort(LOCAL_WS_PORT, PORT_READY_TIMEOUT_MS);
    console.log("[local] rippled is reachable");
  }

  process.env.XRPL_NETWORK = "local";

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

  // Only stop the container if this run started it; leave pre-existing ones alone.
  if (startedByUs) {
    console.log("[local] Stopping rippled (started by this test run)...");
    try {
      await composeDown();
    } catch (err) {
      console.error("[local] docker compose down failed:", err);
    }
  }

  console.log("[local] Cleanup complete");
}
