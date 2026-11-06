/** Queries public facts by source file, result code, account flag, outcome, or bilingual text. */
import path from "node:path";
import type { BehaviorFact, KnowledgeEnvironment } from "../src/kb/types.js";
import { readKnowledgeBase } from "./kb-store.js";

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

  const flag = q.flag?.toLowerCase();
  if (flag) {
    const hasFlag = fact.given.some(
      (g) => g.predicate?.kind === "accountFlag" && g.predicate.flag.toLowerCase() === flag,
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

function describe(fact: BehaviorFact, capture: KnowledgeEnvironment | undefined): string {
  let result = "SUCCEEDS";
  if (fact.outcome.kind === "failure") {
    result = `FAILS with ${fact.outcome.code}`;
  } else if (fact.outcome.note) {
    result += ` (${fact.outcome.note.en})`;
  }
  const given = fact.given.map((g) => g.en).join("; ") || "(no distinguishing preconditions)";

  return [
    `${fact.when.en} → ${result}`,
    `  given:    ${given}`,
    `  verified: ${fact.file} (rippled ${capture?.rippledVersion ?? "unknown"})`,
    `  evidence: ${fact.evidence.txType ?? "-"} ${fact.evidence.txHash ?? "(not submitted)"}`,
  ].join("\n");
}

function main(): void {
  const kb = readKnowledgeBase(path.resolve("docs/kb/behaviors.json"));
  if (!kb) {
    console.error("No knowledge base found. Run `pnpm kb:capture` first.");
    process.exit(1);
  }

  const q = parseArgs(process.argv.slice(2));
  const hits = kb.facts.filter((f) => f.visibility === "public" && matches(f, q)).slice(0, q.limit);

  if (q.json) {
    const used = new Set(hits.map((fact) => fact.captureId));
    const captures = Object.fromEntries(Object.entries(kb.captures).filter(([id]) => used.has(id)));
    const environments = Object.values(hits.length ? captures : kb.captures);
    const environment = environments.length === 1 ? environments[0] : null;
    console.log(JSON.stringify({ environment, captures, count: hits.length, facts: hits }, null, 2));
    return;
  }

  if (hits.length === 0) {
    console.log("No verified behavior matches that query.");
    console.log(`The knowledge base currently covers ${String(kb.facts.length)} facts from these files:`);
    for (const file of new Set(kb.facts.map((f) => f.file))) console.log(`  ${file}`);
    return;
  }

  console.log(`${String(hits.length)} verified behavior(s)\n`);
  for (const fact of hits) console.log(describe(fact, kb.captures[fact.captureId]) + "\n");
}

main();
