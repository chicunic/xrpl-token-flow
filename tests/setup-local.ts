/**
 * Vitest globalSetup for local standalone rippled.
 *
 * Container lifecycle is managed here, not by the developer:
 *   - If the Docker daemon is not running, fail fast with a clear message (start it manually — e.g. Docker Desktop).
 *   - If the rippled container is already up (port reachable), reuse it and leave it running on teardown.
 *   - Otherwise start it via `docker compose up -d`, wait until healthy, and tear it down again after the run.
 *
 * Once connected it starts a periodic ledger_accept timer so submitAndWait works normally.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { TestProject } from "vitest/node";
import { Client, ECDSA, Wallet, xrpToDrops } from "xrpl";
import { LOCAL_XRPL_ENDPOINT } from "../src/config/xrpl.config.js";
import { submitTransaction } from "../src/services/transaction.service.js";

const execFileAsync = promisify(execFile);

const { hostname: LOCAL_WS_HOST, port: localWsPort } = new URL(LOCAL_XRPL_ENDPOINT);
const LOCAL_WS_PORT = Number(localWsPort);
const LEDGER_ACCEPT_INTERVAL_MS = 500;
const PORT_READY_TIMEOUT_MS = 60_000;
const GENESIS_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";

declare module "vitest" {
  interface ProvidedContext {
    fundingSeeds: string[];
    kbShardDir: string;
  }
}

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
    socket.connect(port, LOCAL_WS_HOST);
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
    await client.connection.request({ command: "ledger_accept" });
  }
}

async function startLedgerAcceptTimer(): Promise<Client> {
  client = new Client(LOCAL_XRPL_ENDPOINT, { timeout: 10_000 });
  await client.connect();

  // Close a few ledgers upfront so the genesis account is visible in validated ledger
  for (let i = 0; i < 3; i++) {
    await ledgerAccept();
  }

  timer = setInterval(() => {
    void ledgerAccept().catch(() => {
      // rippled may be busy; retry on the next interval.
    });
  }, LEDGER_ACCEPT_INTERVAL_MS);
  return client;
}

async function prepareFundingWallets(localClient: Client, count: number): Promise<string[]> {
  const genesis = Wallet.fromSeed(GENESIS_SEED, { algorithm: ECDSA.secp256k1 });
  const seeds: string[] = [];

  for (let slot = 0; slot < count; slot++) {
    const wallet = Wallet.generate();
    if (!wallet.seed) throw new Error("Generated funding wallet has no seed");

    const payment = await localClient.autofill({
      TransactionType: "Payment",
      Account: genesis.address,
      Destination: wallet.address,
      Amount: xrpToDrops("10000"),
    });
    await submitTransaction(localClient, payment, genesis);
    seeds.push(wallet.seed);
  }

  return seeds;
}

export async function setup(project: TestProject): Promise<() => Promise<void>> {
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

  try {
    const localClient = await startLedgerAcceptTimer();
    console.log(`[local] ledger_accept timer started (every ${LEDGER_ACCEPT_INTERVAL_MS}ms)`);
    const fundingSeeds = await prepareFundingWallets(localClient, project.config.maxWorkers);
    project.provide("fundingSeeds", fundingSeeds);
    console.log(`[local] prepared ${fundingSeeds.length} worker funding accounts`);
  } catch (error) {
    await teardown(undefined, project);
    throw error;
  }

  const shardDir = process.env.KB_CAPTURE === "1" ? fs.mkdtempSync(path.join(os.tmpdir(), "xrpl-kb-")) : undefined;
  if (shardDir) project.provide("kbShardDir", shardDir);
  return () => teardown(shardDir, project);
}

async function teardown(shardDir: string | undefined, project: TestProject): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  // Merge capture shards while the client is still connected — the environment metadata needs it.
  if (shardDir) {
    try {
      const { state } = project.vitest;
      if (state.getFailedFilepaths().length || state.getUnhandledErrors().length) {
        console.log("[kb] skipped export because the test run failed");
      } else if (client?.isConnected()) {
        const { exportKnowledgeBase } = await import("../scripts/kb-export.js");
        await exportKnowledgeBase(client, { shardDir, outFile: path.resolve("docs/kb/behaviors.json") });
      }
    } catch (err) {
      console.error("[kb] export failed:", err);
    } finally {
      fs.rmSync(shardDir, { recursive: true, force: true });
    }
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
