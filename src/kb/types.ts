/**
 * Types for the verified-behavior knowledge base.
 *
 * A BehaviorFact is one on-chain action paired with one observed outcome, captured while the
 * integration suite runs against a real rippled. Facts are the single source of truth from which
 * `docs/` is generated, so nothing here may describe behavior that was not actually executed.
 */

/** Parallel English/Chinese text. The docs are strict mirror translations, so both are always present. */
export interface Bilingual {
  en: string;
  zh: string;
}

/**
 * A machine-readable precondition observed on the ledger at capture time.
 * Structured (rather than prose) so the knowledge base can be queried by predicate rather than by full-text search.
 */
export type LedgerPredicate =
  | { kind: "accountFlag"; account: string; flag: string; value: boolean }
  | { kind: "transferRate"; account: string; rate: number }
  | {
      kind: "trustLine";
      account: string;
      peer: string;
      currency: string;
      freeze?: boolean;
      deepFreeze?: boolean;
      noRipple?: boolean;
      authorized?: boolean;
      limit?: string;
      balance?: string;
    }
  | { kind: "mptIssuance"; issuanceId: string; flags: string[] }
  | { kind: "mptHolding"; account: string; issuanceId: string; locked?: boolean; authorized?: boolean }
  | { kind: "ledgerObject"; account: string; type: LedgerObjectType; count: number }
  /** Not observable on the ledger — a field present or absent on the submitted transaction (e.g. CredentialIDs). */
  | { kind: "txField"; field: string; present: boolean };

export type LedgerObjectType = "DepositPreauth" | "Credential" | "Escrow" | "Check" | "Ticket" | "SignerList";

export interface GivenCondition extends Bilingual {
  /** `ledger` conditions are backed by a snapshot; `manual` ones were asserted by the test author. */
  source: "ledger" | "manual";
  predicate?: LedgerPredicate;
  /**
   * Groups conditions that describe the same variable, so a multi-column table can put each in its
   * own column. Derived from the predicate when captured; set by hand on manual conditions.
   */
  axis?: string;
}

export type Outcome = { kind: "success"; note?: Bilingual } | { kind: "failure"; code: string; note?: Bilingual };

/** On-chain anchor for a fact. `tem`/`tef` failures never reach a ledger, so these stay null. */
export interface Evidence {
  txHash: string | null;
  txType: string | null;
  ledgerIndex: number | null;
  capturedAt: string;
}

export interface BehaviorFact {
  /** Stable across runs: derived from the suite path and the fact's ordinal within it. */
  id: string;
  domain: "trust-line-token" | "multi-purpose-token";
  /** Source test file, relative to the repo root. */
  file: string;
  /** The describe() chain, e.g. ["Trust Line Token Deep Freeze", "Phase 5: Clear Deep Freeze Only"]. */
  suite: string[];
  /** The it() title. */
  test: string;
  /** The operation under test — the table's subject column. */
  when: Bilingual;
  /** Preconditions — the table's condition columns. */
  given: GivenCondition[];
  outcome: Outcome;
  evidence: Evidence;
  /** `internal` facts are kept in JSON but omitted from generated docs (e.g. bare flag verifications). */
  visibility: "public" | "internal";
}

/** Provenance for a capture run. This is what lets a consumer judge whether a fact still applies. */
export interface KnowledgeEnvironment {
  rippledVersion: string;
  networkId: number | null;
  /** Enabled amendments, by name where known, otherwise by hash. */
  amendments: string[];
  gitCommit: string | null;
  capturedAt: string;
}

export interface KnowledgeBase {
  schemaVersion: 1;
  environment: KnowledgeEnvironment;
  stats: { total: number; captured: number; coverage: number };
  facts: BehaviorFact[];
}
