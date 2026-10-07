/**
 * Capture runtime for the knowledge base: ledger snapshots in, NDJSON shards out.
 *
 * Everything here is inert unless KB_CAPTURE=1, and every failure degrades to a partial fact rather
 * than propagating — the suite's first duty is to test, not to document.
 *
 * Vitest runs files across worker processes, so each worker appends to its own shard and the
 * globalSetup teardown merges them. NDJSON (not a JSON array) so a killed worker still leaves
 * every line it already wrote intact.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect } from "vitest";
import type { Client, Wallet } from "xrpl";
import { AccountRootFlags, RippleStateFlags } from "xrpl/dist/npm/models/ledger/index.js";
import { getXRPLClient } from "@/config/xrpl.config.js";
import type { Evidence, GivenCondition, LedgerObjectType, LedgerPredicate, Outcome } from "@/kb/types.js";
import { currencyToHex, setTxObserver } from "@/services/transaction.service.js";
import { CURRENCY } from "./data.js";
import type { FactSpec } from "./kb.js";
import { phrase } from "./kb-phrases.js";

export const KB_ENABLED = process.env.KB_CAPTURE === "1";
const SHARD_DIR = process.env.KB_SHARD_DIR ?? path.resolve(process.cwd(), ".temp/kb");

/** A named participant in a fact, so the tracker knows whose ledger state to read. */
export interface Actor {
  /** Semantic role, e.g. "issuer", "alice". Used to phrase conditions in the docs. */
  role: string;
  wallet: Wallet;
  /** Snapshot this account's trust line against the issuer identified by this role. */
  trustLineWith?: string;
  currency?: string;
  /** Snapshot MPT issuance flags and this holder's lock/auth bits. */
  mptIssuanceId?: string;
  /** Ledger object types to count for this account, e.g. DepositPreauth for grant/revoke pairs. */
  ledgerObjects?: LedgerObjectType[];
}

export interface SubmittedTx {
  txType: string;
  hash: string;
  ledgerIndex: number | null;
  result: string;
}

let latestTx: SubmittedTx | null = null;

/** The most recent transaction seen by the observer, used to anchor a fact to a real hash. */
export function lastSubmittedTx(): SubmittedTx | null {
  return latestTx;
}

/** Installs the transaction observer. Called once per worker from the test setup file. */
export function installTxObserver(): void {
  if (!KB_ENABLED) return;
  setTxObserver((info) => {
    latestTx = info;
  });
}

// xrpl.js exports no MPToken ledger-flag constants. lsfMPTLocked was read off a live ledger:
// an individual lock sets Flags to 0x1 and unlocking clears it back to 0x0.
const MPTOKEN_LOCKED = 0x00000001;
const MPTOKEN_AUTHORIZED = 0x00000002;

/** Account flags worth reporting as preconditions, by lsf* name. */
const TRACKED_ACCOUNT_FLAGS: Record<string, number> = {
  lsfRequireAuth: AccountRootFlags.lsfRequireAuth,
  lsfDepositAuth: AccountRootFlags.lsfDepositAuth,
  lsfDisallowXRP: AccountRootFlags.lsfDisallowXRP,
  lsfDisableMaster: AccountRootFlags.lsfDisableMaster,
  lsfDefaultRipple: AccountRootFlags.lsfDefaultRipple,
  lsfGlobalFreeze: AccountRootFlags.lsfGlobalFreeze,
  lsfNoFreeze: AccountRootFlags.lsfNoFreeze,
  lsfAllowTrustLineClawback: AccountRootFlags.lsfAllowTrustLineClawback,
};

/** Names the variable a predicate describes, so multi-column tables can route it to a column. */
function axisOf(predicate: LedgerPredicate): string {
  switch (predicate.kind) {
    case "accountFlag":
      return `${predicate.account}.${predicate.flag}`;
    case "trustLine":
      return `${predicate.account}.trustLine`;
    case "ledgerObject":
      return `${predicate.account}.${predicate.type}`;
    case "mptHolding":
      return `${predicate.account}.mpt`;
    case "mptIssuance":
      return "mptIssuance";
    case "transferRate":
      return `${predicate.account}.transferRate`;
    case "txField":
      return `tx.${predicate.field}`;
  }
}

function condition(predicate: LedgerPredicate): GivenCondition | null {
  const text = phrase(predicate);
  if (!text) return null;
  return { ...text, source: "ledger", predicate, axis: axisOf(predicate) };
}

async function accountFlagConditions(client: Client, actor: Actor): Promise<GivenCondition[]> {
  const info = await client.request({
    command: "account_info",
    account: actor.wallet.address,
    ledger_index: "validated",
  });
  const flags = BigInt(info.result.account_data.Flags);
  const out: GivenCondition[] = [];

  for (const [name, mask] of Object.entries(TRACKED_ACCOUNT_FLAGS)) {
    if ((flags & BigInt(mask)) === BigInt(mask)) {
      const c = condition({ kind: "accountFlag", account: actor.role, flag: name, value: true });
      if (c) out.push(c);
    }
  }

  const rate = info.result.account_data.TransferRate;
  if (rate !== undefined && rate !== 0) {
    const c = condition({ kind: "transferRate", account: actor.role, rate });
    if (c) out.push(c);
  }
  return out;
}

/**
 * Reads trust line state from the RippleState object rather than account_lines, because
 * account_lines does not expose the XLS-77 deep freeze bits at all.
 */
async function trustLineConditions(
  client: Client,
  actor: Actor,
  issuer: Actor,
  currency: string,
): Promise<GivenCondition[]> {
  const response = await client.request({
    command: "ledger_entry",
    ripple_state: {
      accounts: [actor.wallet.address, issuer.wallet.address],
      currency: currencyToHex(currency),
    },
    ledger_index: "validated",
  });

  const node = response.result.node as unknown as
    { Flags?: number; LowLimit?: { issuer: string }; Balance?: { value: string } } | undefined;
  if (!node?.Flags) return [];

  const flags = node.Flags;
  // The issuer holds the "low" side when it is LowLimit.issuer; its bits are the low ones.
  const issuerIsLow = node.LowLimit?.issuer === issuer.wallet.address;
  const has = (mask: number): boolean => (flags & mask) === mask;

  const freeze = issuerIsLow ? has(RippleStateFlags.lsfLowFreeze) : has(RippleStateFlags.lsfHighFreeze);
  const deepFreeze = issuerIsLow ? has(RippleStateFlags.lsfLowDeepFreeze) : has(RippleStateFlags.lsfHighDeepFreeze);
  const authorized = issuerIsLow ? has(RippleStateFlags.lsfLowAuth) : has(RippleStateFlags.lsfHighAuth);
  // no_ripple_peer in account_lines terms: the issuer's side of the NoRipple flag.
  const noRipple = issuerIsLow ? has(RippleStateFlags.lsfLowNoRipple) : has(RippleStateFlags.lsfHighNoRipple);

  if (!freeze && !deepFreeze && !authorized) return [];

  const c = condition({
    kind: "trustLine",
    account: actor.role,
    peer: issuer.role,
    currency,
    freeze,
    deepFreeze,
    authorized,
    noRipple,
  });
  return c ? [c] : [];
}

/**
 * Ledger objects an account owns, reported as counts. This is how grant/revoke pairs become
 * visible: a DepositPreauth exists after preauthorizing and is gone after revoking, with no
 * account flag distinguishing the two states.
 */
async function ledgerObjectConditions(client: Client, actor: Actor): Promise<GivenCondition[]> {
  const out: GivenCondition[] = [];

  for (const type of actor.ledgerObjects ?? []) {
    const response = await client.request({
      command: "account_objects",
      account: actor.wallet.address,
      type: type.toLowerCase() as "deposit_preauth",
      ledger_index: "validated",
    });
    const count = response.result.account_objects.length;
    const c = condition({ kind: "ledgerObject", account: actor.role, type, count });
    if (c) out.push(c);
  }
  return out;
}

/** MPT holdings: the issuance's flags plus this holder's lock/authorization bits. */
async function mptConditions(client: Client, actor: Actor): Promise<GivenCondition[]> {
  const issuanceId = actor.mptIssuanceId;
  if (!issuanceId) return [];

  const response = await client.request({
    command: "account_objects",
    account: actor.wallet.address,
    type: "mptoken",
    ledger_index: "validated",
  });
  const holdings = response.result.account_objects as unknown as {
    MPTokenIssuanceID?: string;
    Flags?: number;
  }[];
  const holding = holdings.find((h) => h.MPTokenIssuanceID === issuanceId);
  if (!holding) return [];

  const flags = holding.Flags ?? 0;
  const c = condition({
    kind: "mptHolding",
    account: actor.role,
    issuanceId,
    locked: (flags & MPTOKEN_LOCKED) === MPTOKEN_LOCKED,
    authorized: (flags & MPTOKEN_AUTHORIZED) === MPTOKEN_AUTHORIZED,
  });
  return c ? [c] : [];
}

/**
 * Snapshots the ledger state of every actor and derives the preconditions holding right now.
 *
 * This is what makes cross-phase conditions recoverable: a test that only calls unfreeze() still
 * reports "freeze + deep freeze" as its precondition, because the ledger says so even though the
 * `it` body never mentions it.
 *
 * Degrades to the manually supplied conditions on any failure — capture must never fail a test.
 */
export async function captureGiven(spec: FactSpec): Promise<GivenCondition[]> {
  if (!KB_ENABLED) return [];
  if (spec.givenOverride) return spec.givenOverride;

  const manual = spec.givenExtra ?? [];
  try {
    const client = getXRPLClient();
    const byRole = new Map(spec.actors.map((a) => [a.role, a]));

    const results = await Promise.all(
      spec.actors.map(async (actor) => {
        const conditions = await accountFlagConditions(client, actor);
        const issuer = actor.trustLineWith ? byRole.get(actor.trustLineWith) : undefined;
        if (issuer) {
          conditions.push(...(await trustLineConditions(client, actor, issuer, actor.currency ?? CURRENCY)));
        }
        conditions.push(...(await ledgerObjectConditions(client, actor)));
        conditions.push(...(await mptConditions(client, actor)));
        return conditions;
      }),
    );

    // Dedupe: several actors commonly share a condition (e.g. both holders frozen).
    const seen = new Set<string>();
    const ledger = results.flat().filter((c) => {
      if (seen.has(c.en)) return false;
      seen.add(c.en);
      return true;
    });
    return [...ledger, ...manual];
  } catch {
    return manual;
  }
}

export interface RawFact {
  spec: FactSpec;
  given: GivenCondition[];
  outcome: Outcome;
  evidence: Omit<Evidence, "capturedAt">;
}

let stream: fs.WriteStream | null = null;
const ordinals = new Map<string, number>();

function shardStream(): fs.WriteStream {
  if (!stream) {
    fs.mkdirSync(SHARD_DIR, { recursive: true });
    stream = fs.createWriteStream(path.join(SHARD_DIR, `${String(process.pid)}-${randomUUID()}.ndjson`), {
      flags: "a",
    });
  }
  return stream;
}

/** Appends one fact to this worker's shard. Never throws. */
export function recordFact(raw: RawFact): void {
  if (!KB_ENABLED) return;
  try {
    const state = expect.getState();
    const testPath = state.testPath ?? "unknown";
    const file = path.relative(process.cwd(), testPath);
    // currentTestName is "Suite > Nested > test name"; the last segment is the it() title.
    const segments = (state.currentTestName ?? "").split(" > ");
    const test = segments.at(-1) ?? "";
    const suite = segments.slice(0, -1);

    const ordinal = (ordinals.get(file) ?? 0) + 1;
    ordinals.set(file, ordinal);

    shardStream().write(
      JSON.stringify({
        id: `${file}#${String(ordinal)}`,
        domain: file.includes("multi-purpose-token") ? "multi-purpose-token" : "trust-line-token",
        file,
        suite,
        test,
        when: raw.spec.when,
        given: raw.given,
        outcome: raw.outcome,
        evidence: { ...raw.evidence, capturedAt: new Date().toISOString() },
        visibility: raw.spec.visibility ?? "public",
      }) + "\n",
    );
  } catch {
    // Capture is best-effort; a broken knowledge base must never fail a passing test.
  }
}
