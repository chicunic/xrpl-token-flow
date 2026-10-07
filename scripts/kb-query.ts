/**
 * Queries the verified-behavior knowledge base.
 *
 * Facts carry structured predicates, so this filters on ledger state and result codes rather than
 * matching prose. That is the difference between "a doc mentions DepositAuth somewhere" and "these
 * are the behaviors verified with DepositAuth enabled, and here are their transaction hashes".
 *
 *   tsx scripts/kb-query.ts --feature deep-freeze
 *   tsx scripts/kb-query.ts --code tecNO_PERMISSION
 *   tsx scripts/kb-query.ts --flag lsfDepositAuth --outcome failure
 *   tsx scripts/kb-query.ts --text credential --json
 */
import fs from "node:fs";
import path from "node:path";
import type { BehaviorFact, KnowledgeBase } from "../src/kb/types.js";

interface Query {
  feature?: string;
  code?: string;
  flag?: string;
  outcome?: "success" | "failure";
  text?: string;
  json: boolean;
  limit: number;
}

function parseArgs(argv: string[]): Query {
  const q: Query = { json: false, limit: 50 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => argv[++i] ?? "";
    switch (arg) {
      case "--feature":
        q.feature = next();
        break;
      case "--code":
        q.code = next();
        break;
      case "--flag":
        q.flag = next();
        break;
      case "--outcome": {
        const value = next();
        if (value === "success" || value === "failure") q.outcome = value;
        break;
      }
      case "--text":
        q.text = next().toLowerCase();
        break;
      case "--json":
        q.json = true;
        break;
      case "--limit":
        q.limit = Number(next()) || 50;
        break;
    }
  }
  return q;
}

function matches(fact: BehaviorFact, q: Query): boolean {
  if (q.feature && !fact.file.includes(q.feature)) return false;
  if (q.outcome && fact.outcome.kind !== q.outcome) return false;
  if (q.code && !(fact.outcome.kind === "failure" && fact.outcome.code === q.code)) return false;

  if (q.flag) {
    const hasFlag = fact.given.some(
      (g) => g.predicate?.kind === "accountFlag" && g.predicate.flag.toLowerCase() === q.flag?.toLowerCase(),
    );
    if (!hasFlag) return false;
  }

  if (q.text) {
    const haystack = [fact.when.en, fact.when.zh, fact.test, ...fact.given.flatMap((g) => [g.en, g.zh])]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q.text)) return false;
  }
  return true;
}

function describe(fact: BehaviorFact): string {
  const result =
    fact.outcome.kind === "failure"
      ? `FAILS with ${fact.outcome.code}`
      : `SUCCEEDS${fact.outcome.note ? ` (${fact.outcome.note.en})` : ""}`;
  const given = fact.given.map((g) => g.en).join("; ") || "(no distinguishing preconditions)";

  return [
    `${fact.when.en} → ${result}`,
    `  given:    ${given}`,
    `  verified: ${fact.file}`,
    `  evidence: ${fact.evidence.txType ?? "-"} ${fact.evidence.txHash ?? "(not submitted)"}`,
  ].join("\n");
}

function main(): void {
  const kbPath = path.join(process.cwd(), "docs/kb/behaviors.json");
  if (!fs.existsSync(kbPath)) {
    console.error("No knowledge base found. Run `pnpm kb:capture` first.");
    process.exit(1);
  }

  const kb = JSON.parse(fs.readFileSync(kbPath, "utf8")) as KnowledgeBase;
  const q = parseArgs(process.argv.slice(2));
  const hits = kb.facts.filter((f) => f.visibility === "public" && matches(f, q)).slice(0, q.limit);

  if (q.json) {
    console.log(JSON.stringify({ environment: kb.environment, count: hits.length, facts: hits }, null, 2));
    return;
  }

  if (hits.length === 0) {
    console.log("No verified behavior matches that query.");
    console.log(`The knowledge base currently covers ${String(kb.facts.length)} facts from these files:`);
    for (const file of new Set(kb.facts.map((f) => f.file))) console.log(`  ${file}`);
    return;
  }

  console.log(`${String(hits.length)} verified behavior(s) — rippled ${kb.environment.rippledVersion}\n`);
  for (const fact of hits) console.log(describe(fact) + "\n");
}

main();
