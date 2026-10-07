/**
 * Annotation API for the verified-behavior knowledge base.
 *
 * The atomic unit is an assertion, not an `it` — a third of the suite's tests assert more than one
 * behavior, and a fifth assert success purely by not throwing. So facts are recorded at the
 * assertion site rather than inferred from test structure.
 *
 * `expectTxFail`'s spec argument is optional, so unmigrated call sites keep working untouched.
 */
import { expect } from "vitest";
import type { Bilingual, GivenCondition } from "@/kb/types.js";
import { TransactionResultError } from "@/services/transaction.service.js";
import { type Actor, captureGiven, lastSubmittedTx, recordFact } from "./kb-runtime.js";

export interface FactSpec {
  /** The operation under test, as it should read in the docs table's subject column. */
  when: Bilingual;
  /** Accounts and objects involved, so the tracker knows what ledger state to snapshot. */
  actors: Actor[];
  /** Preconditions the ledger snapshot cannot see, such as a field omitted from the transaction. */
  givenExtra?: GivenCondition[];
  /** Qualifies the outcome, e.g. "claws back entire balance". */
  note?: Bilingual;
  /** Replaces the captured conditions outright. Escape hatch; prefer `givenExtra`. */
  givenOverride?: GivenCondition[];
  /** `internal` keeps the fact out of generated docs. */
  visibility?: "public" | "internal";
}

/**
 * Asserts a transaction fails with the given result code (tec/tef/tem/ter).
 * Passing `spec` additionally records the failure as a behavior fact.
 */
export async function expectTxFail(
  expectedResult: string,
  action: () => Promise<unknown>,
  spec?: FactSpec,
): Promise<void> {
  const given = spec ? await captureGiven(spec) : null;

  let caught: unknown;
  await expect(
    action().catch((error: unknown) => {
      caught = error;
      throw error;
    }),
  ).rejects.toThrow(expectedResult);

  if (!spec) return;

  // Prefer the structured code off TransactionResultError; fall back to the expected one for
  // client-side rejections (tem*) that never reach extractMeta.
  const failure = caught instanceof TransactionResultError ? caught : null;
  recordFact({
    spec,
    given: given ?? [],
    outcome: { kind: "failure", code: failure?.result ?? expectedResult, note: spec.note },
    evidence: failure
      ? { txHash: failure.hash, txType: failure.txType, ledgerIndex: lastSubmittedTx()?.ledgerIndex ?? null }
      : { txHash: null, txType: null, ledgerIndex: null },
  });
}

/**
 * Records a successful on-chain action as a behavior fact. The action not throwing is the assertion —
 * `submitTransaction` rejects on any non-tesSUCCESS result.
 *
 * Returns the action's value, so it composes with services that return an id:
 *   const id = await factSucceeds(spec, () => createMPTokenIssuance(issuer));
 */
export async function factSucceeds<T>(spec: FactSpec, action: () => Promise<T>): Promise<T> {
  const given = await captureGiven(spec);
  const result = await action();

  const submitted = lastSubmittedTx();
  recordFact({
    spec,
    given,
    outcome: { kind: "success", note: spec.note },
    evidence: {
      txHash: submitted?.hash ?? null,
      txType: submitted?.txType ?? null,
      ledgerIndex: submitted?.ledgerIndex ?? null,
    },
  });
  return result;
}

/**
 * Records observed ledger state as a fact without performing an action — the counterpart to
 * `verifyAccountFlag`. Defaults to `internal` so bare state checks do not bloat the docs tables.
 */
export async function factState(spec: FactSpec): Promise<void> {
  const given = await captureGiven(spec);
  recordFact({
    spec: { visibility: "internal", ...spec },
    given,
    outcome: { kind: "success", note: spec.note },
    evidence: { txHash: null, txType: null, ledgerIndex: null },
  });
}
