/**
 * Merges per-worker capture shards into the knowledge base.
 *
 * Runs from the vitest globalSetup teardown, while the client is still connected — the rippled
 * version and amendment set are what let a consumer judge whether a fact still applies, so they
 * must be recorded alongside the facts rather than inferred later.
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { Client } from "xrpl";
import type { BehaviorFact, KnowledgeBase, KnowledgeEnvironment } from "../src/kb/types.js";
import { readKnowledgeBase } from "./kb-store.js";

const execFileAsync = promisify(execFile);

/** Index of the singleton Amendments ledger object. */
const AMENDMENTS_INDEX = "7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4";

async function gitCommit(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { timeout: 5000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function readEnvironment(client: Client): Promise<KnowledgeEnvironment> {
  const [info, commit] = await Promise.all([client.request({ command: "server_info" }), gitCommit()]);

  let amendments: string[] = [];
  try {
    const response = await client.request({
      command: "ledger_entry",
      index: AMENDMENTS_INDEX,
      ledger_index: "validated",
    });
    const node = response.result.node as unknown as { Amendments?: string[] } | undefined;
    amendments = node?.Amendments ?? [];
  } catch {
    // A standalone rippled may not expose the Amendments object; absence is not an error.
  }

  return {
    rippledVersion: info.result.info.build_version,
    networkId: info.result.info.network_id ?? null,
    amendments,
    gitCommit: commit,
    capturedAt: new Date().toISOString(),
  };
}

function readShards(shardDir: string): BehaviorFact[] {
  if (!fs.existsSync(shardDir)) return [];

  const facts = new Map<string, BehaviorFact>();
  for (const name of fs.readdirSync(shardDir)) {
    if (!name.endsWith(".ndjson")) continue;
    const raw = fs.readFileSync(path.join(shardDir, name), "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const fact = JSON.parse(line) as BehaviorFact;
        facts.set(fact.id, fact);
      } catch {
        // A torn final line from a killed worker; every earlier line is still usable.
      }
    }
  }

  // Numeric ordinals must sort as numbers, so #10 follows #9 rather than #1.
  return [...facts.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Total `it` count across the suite, used only to report capture coverage. */
const TOTAL_TESTS = 232;

export async function exportKnowledgeBase(
  client: Client,
  options: { shardDir: string; outFile: string },
): Promise<void> {
  const captured = readShards(options.shardDir);
  if (captured.length === 0) {
    console.log("[kb] no facts captured — nothing to write");
    return;
  }

  const environment = await readEnvironment(client);
  const captureId = randomUUID();
  fs.mkdirSync(path.dirname(options.outFile), { recursive: true });
  // Hold the temporary file exclusively through the read, merge, and atomic replacement.
  const tmp = `${options.outFile}.tmp`;
  const fd = fs.openSync(tmp, "wx");
  let carried: number;
  try {
    try {
      const previous = readKnowledgeBase(options.outFile);
      const capturedFiles = new Set(captured.map((fact) => fact.file));
      const kept = previous?.facts.filter((fact) => !capturedFiles.has(fact.file)) ?? [];
      carried = kept.length;
      const facts = [...kept, ...captured.map((fact) => ({ ...fact, captureId }))].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true }),
      );
      const used = new Set(facts.map((fact) => fact.captureId));
      const captures = { ...previous?.captures, [captureId]: environment };
      const kb: KnowledgeBase = {
        schemaVersion: 2,
        captures: Object.fromEntries(Object.entries(captures).filter(([id]) => used.has(id))),
        stats: {
          total: TOTAL_TESTS,
          captured: facts.length,
          coverage: Number((facts.length / TOTAL_TESTS).toFixed(4)),
        },
        facts,
      };

      fs.writeFileSync(fd, JSON.stringify(kb, null, 2) + "\n");
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, options.outFile);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }

  console.log(`[kb] captured ${captured.length} facts on rippled ${environment.rippledVersion}, retained ${carried}`);
}
