# xrpl-token-flow

An XRPL behavior test suite that doubles as a knowledge base: the integration tests run against a
real rippled, and the behaviors they verify are captured as structured facts that generate `docs/`.

## Running tests

Tests need Docker — `tests/setup-local.ts` starts a standalone rippled and stops it afterwards
(reusing an already-running container if one is up). If the daemon is down, the run fails fast; ask
the user to start Docker Desktop rather than starting it yourself.

```bash
pnpm test                      # all 32 files, ~3 min
pnpm test deep-freeze          # one suite
pnpm check                     # tsc + eslint + prettier
```

## Test structure

Most files are `describe > describe("Phase N: ...") > it`, and **phases share mutable state**: an
`it` in Phase 4 typically depends on flags set in Phase 2. Files run in parallel; `it`s within a
file are strictly sequential and cannot be reordered or run in isolation.

Four files (`regular-key` and `ticket`, in both token families) are flat instead, with a trailing
`describe("Edge Cases")`; `trust-line-token/regular-key.test.ts` has a nested `beforeAll`.

Success is often asserted only by _not throwing_ — `submitTransaction` rejects on any non-`tesSUCCESS`
result, so a bare `await` is a real assertion. Roughly a fifth of tests have no `expect` at all.

## The knowledge base

`docs/kb/behaviors.json` holds facts captured during a run: what was attempted, the preconditions
that held, the outcome, and the transaction hash proving it. `docs/*.md` tables are generated from
it. Capture is off unless `KB_CAPTURE=1`, so ordinary runs are unaffected.

```bash
pnpm kb:capture                # KB_CAPTURE=1 vitest run — captures everything
pnpm kb:check                  # generated docs must match the committed ones; CI gate
pnpm kb:docs                   # write generated sections into docs/
pnpm kb:query --code tecLOCKED # query verified behavior
```

`kb:capture` merges **per source file**: files the run touched are rebuilt, files it did not are
carried over. So capturing one file is safe and does not discard the rest.

### Annotating a behavior

The unit is an assertion, not an `it` — a third of tests assert several behaviors, so annotations
attach to the call, not the test.

```ts
await expectTxFail("tecPATH_DRY", () => transferTokens(alice, bob, AMOUNT, issuer), {
  when: { en: "Deep-frozen holder sends", zh: "深度冻结的持有者发送" },
  actors: actors(),
});

await factSucceeds({ when: { en: "...", zh: "..." }, actors: actors() }, () => transferTokens(...));
```

`expectTxFail`'s third argument is optional, so unannotated call sites keep working.

Preconditions are **read from the ledger at assertion time**, not declared: a test that only calls
`unfreeze()` still reports "Freeze + deep freeze" because the ledger says so. Declare participants
via `actors()` and the snapshot does the rest — `trustLineWith` for trust line state,
`ledgerObjects` for grant/revoke pairs like `DepositPreauth`, `mptIssuanceId` for MPT holdings.

Use `givenExtra` only for what a snapshot genuinely cannot see:

- a **transaction field**, e.g. whether `CredentialIDs` was attached — identical ledger state, opposite outcomes
- an **absent** state, e.g. "trust line not frozen" or distinguishing "never granted" from "revoked"

Use `givenOverride` to replace derived conditions entirely; prefer `givenExtra`.

### Two rules that are easy to get wrong

**Copy Chinese wording from the committed docs verbatim — do not translate it.** English `when`
values almost always match on the first try; hand-written Chinese almost never does. The docs keep
English terms in Chinese tables (`Issuer → Bob USD (mint)`, not `(铸造)`; `Issuer 不受限`, not
`发行方不受限`). Read the `.zh-CN.md` section first and copy the cell.

**`kb:check` must stay at zero diff.** A diff means either a generator bug or real drift between
what the tests verify and what the docs claim. Both need a human decision — never let the generator
silently rewrite a table. Section formatting (column headers, `present`/`empty` labels, result
style) lives in `scripts/kb-sections.ts`; per-column routing uses the `axis` tag.

## Conventions

- Verify XRPL flag constants against `xrpl` rather than hardcoding them. `RippleStateFlags` and
  `AccountRootFlags` are exported; MPToken ledger flags are not, and `lsfMPTLocked = 0x1` was
  confirmed by reading a live ledger.
- Trust line state comes from `ledger_entry` + `ripple_state`, **not** `account_lines` — the latter
  has no deep-freeze field. Low/high sides are resolved via `LowLimit.issuer`.
- Capture must never fail a test: `captureGiven` degrades to manual conditions on any error, and
  `recordFact` swallows everything.
- `tsconfig.src.json` sets `noUncheckedIndexedAccess` and `noUnusedLocals`; index into arrays with
  `?? fallback`.
- Git write commands are the user's to run — provide the command, don't execute it.
