import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { Client } from "xrpl";
import type { BehaviorFact } from "@/kb/types.js";
import { exportKnowledgeBase } from "../../scripts/kb-export.js";
import { readKnowledgeBase } from "../../scripts/kb-store.js";

function fact(file: string): BehaviorFact {
  return {
    id: `${file}#1`,
    file,
    domain: "trust-line-token",
    suite: [],
    test: "payment",
    when: { en: "Payment", zh: "付款" },
    given: [],
    outcome: { kind: "success" },
    evidence: { txHash: null, txType: null, ledgerIndex: null, capturedAt: "2026-01-01T00:00:00Z" },
    visibility: "public",
  };
}

it("preserves legacy provenance for facts from files outside a partial capture", async () => {
  const shardDir = fs.mkdtempSync(path.join(os.tmpdir(), "xrpl-kb-test-"));
  const outFile = path.join(shardDir, "behaviors.json");
  const rerun = fact("rerun.test.ts");
  const retained = fact("retained.test.ts");
  const client = new Client("ws://127.0.0.1:6006");
  vi.spyOn(client, "request")
    .mockResolvedValueOnce({ result: { info: { build_version: "3.3.0", network_id: 2 } } })
    .mockResolvedValueOnce({ result: { node: { Amendments: ["new amendment"] } } });

  try {
    fs.writeFileSync(
      outFile,
      JSON.stringify({
        schemaVersion: 1,
        environment: {
          rippledVersion: "3.1.3",
          networkId: 2,
          amendments: ["old amendment"],
          gitCommit: null,
          capturedAt: retained.evidence.capturedAt,
        },
        stats: { total: 2, captured: 2, coverage: 1 },
        facts: [rerun, retained],
      }),
    );
    fs.writeFileSync(path.join(shardDir, "worker.ndjson"), JSON.stringify(rerun) + "\n");

    await exportKnowledgeBase(client, { shardDir, outFile });

    const kb = readKnowledgeBase(outFile);
    expect(kb?.schemaVersion).toBe(2);
    expect(kb?.facts.map(({ file, captureId }) => [file, kb.captures[captureId]?.rippledVersion])).toEqual([
      [rerun.file, "3.3.0"],
      [retained.file, "3.1.3"],
    ]);
  } finally {
    fs.rmSync(shardDir, { recursive: true, force: true });
  }
});
