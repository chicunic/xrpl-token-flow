/**
 * Merges per-worker capture shards into the knowledge base.
 *
 * Runs from the vitest globalSetup teardown, while the client is still connected — the rippled
 * version and amendment set are what let a consumer judge whether a fact still applies, so they
 * must be recorded alongside the facts rather than inferred later.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { Client } from "xrpl";
import type { BehaviorFact, KnowledgeBase, KnowledgeEnvironment } from "../src/kb/types.js";

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
        // Later writes win, so a re-run supersedes a stale capture of the same fact.
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
const TOTAL_TESTS = 230;

/**
 * Merges a capture into the existing knowledge base.
 *
 * Replacement is per source file, not per fact: every file this run touched is rebuilt from the
 * capture, so facts deleted from a test disappear, while files the run never executed keep what
 * they had. Without this, running a single test file would discard every other file's facts.
 */
function mergeFacts(previous: BehaviorFact[], captured: BehaviorFact[]): BehaviorFact[] {
  const capturedFiles = new Set(captured.map((f) => f.file));
  const kept = previous.filter((f) => !capturedFiles.has(f.file));
  return [...kept, ...captured].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function readExisting(outFile: string): BehaviorFact[] {
  if (!fs.existsSync(outFile)) return [];
  try {
    return (JSON.parse(fs.readFileSync(outFile, "utf8")) as KnowledgeBase).facts;
  } catch {
    // A corrupt knowledge base should not block a fresh capture from replacing it.
    return [];
  }
}

export async function exportKnowledgeBase(
  client: Client,
  options: { shardDir: string; outFile: string },
): Promise<void> {
  const captured = readShards(options.shardDir);
  if (captured.length === 0) {
    console.log("[kb] no facts captured — nothing to write");
    return;
  }

  const previous = readExisting(options.outFile);
  const facts = mergeFacts(previous, captured);
  const carried = facts.length - captured.length;

  const kb: KnowledgeBase = {
    schemaVersion: 1,
    environment: await readEnvironment(client),
    stats: {
      total: TOTAL_TESTS,
      captured: facts.length,
      coverage: Number((facts.length / TOTAL_TESTS).toFixed(4)),
    },
    facts,
  };

  fs.mkdirSync(path.dirname(options.outFile), { recursive: true });
  // Write-then-rename so a crash mid-write cannot truncate an existing knowledge base.
  const tmp = `${options.outFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(kb, null, 2) + "\n");
  fs.renameSync(tmp, options.outFile);

  console.log(
    `[kb] wrote ${String(facts.length)} facts to ${path.relative(process.cwd(), options.outFile)} ` +
      `(${String(captured.length)} captured, ${String(carried)} carried over; rippled ${kb.environment.rippledVersion})`,
  );

  // Shards are consumed; clearing them keeps the next run's counts honest.
  fs.rmSync(options.shardDir, { recursive: true, force: true });
}
