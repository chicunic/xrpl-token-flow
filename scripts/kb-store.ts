import fs from "node:fs";
import type { BehaviorFact, KnowledgeBase, KnowledgeEnvironment } from "../src/kb/types.js";

interface LegacyKnowledgeBase {
  schemaVersion: 1;
  environment: KnowledgeEnvironment;
  stats: KnowledgeBase["stats"];
  facts: BehaviorFact[];
}

export function readKnowledgeBase(file: string): KnowledgeBase | undefined {
  if (!fs.existsSync(file)) return undefined;

  const kb = JSON.parse(fs.readFileSync(file, "utf8")) as LegacyKnowledgeBase | KnowledgeBase;
  switch (kb.schemaVersion) {
    case 1:
      return {
        schemaVersion: 2,
        captures: { legacy: kb.environment },
        stats: kb.stats,
        facts: kb.facts.map((fact) => ({ ...fact, captureId: "legacy" })),
      };
    case 2:
      return kb;
    default:
      throw new Error(`Unsupported knowledge-base schema in ${file}`);
  }
}
