# xrpl-token-flow

An XRPL behavior test suite and knowledge base: integration tests run against a real rippled, and annotated assertions capture structured facts for selected `docs/` sections.

## Running tests

`tests/setup-local.ts` starts a standalone rippled with Docker and stops it afterward, or reuses an existing node and leaves it running.
If the Docker daemon is down, ask the user to start Docker Desktop; do not start it yourself.

```bash
pnpm test
pnpm test deep-freeze
pnpm check
```

Files run in parallel; tests within each file run sequentially and share mutable ledger state.
Do not reorder tests or run individual cases in isolation.
Most suites use nested phases; the regular-key and ticket suites use a flat structure followed by `describe("Edge Cases")`, and the trust-line regular-key suite also has a nested `beforeAll`.

A bare `await` of a service operation can assert success: `submitTransaction` rejects any validated result other than `tesSUCCESS`.

## Knowledge base

`docs/kb/behaviors.json` stores captured facts and transaction evidence; `scripts/kb-sections.ts` defines which documentation sections are generated and their formatting.
Capture is disabled unless `KB_CAPTURE=1`.
A capture replaces facts per executed source file and preserves files that were not run, so capturing one suite does not discard the rest.

```bash
pnpm kb:capture
pnpm kb:check
pnpm kb:docs
pnpm kb:query --code tecLOCKED
```

**Keep `kb:check` at zero diff.** Drift indicates a generator bug or a mismatch between verified behavior and documentation; resolve it with a human decision before running `kb:docs`, never silently rewrite the tables.
Column headers, empty/present labels, and result styles belong in `scripts/kb-sections.ts`; the `axis` tag routes conditions into columns.

### Annotating behaviors

Annotate assertions rather than whole tests, because a test may verify several behaviors.
The third argument to `expectTxFail` is optional.

```ts
await expectTxFail("tecPATH_DRY", () => transferTokens(alice, bob, AMOUNT, issuer), {
  when: { en: "Deep-frozen holder sends", zh: "深度冻结的持有者发送" },
  actors: actors(),
});

await factSucceeds({ when: { en: "...", zh: "..." }, actors: actors() }, () => transferTokens(...));
```

Preconditions come from the ledger before the assertion's action, so a test that only calls `unfreeze()` still captures "Freeze + deep freeze" when both flags are set.
Declare participants with `actors()`: use `trustLineWith` for trust line state, `ledgerObjects` for grant/revoke pairs such as `DepositPreauth`, and `mptIssuanceId` for MPT holdings.

Use `givenExtra` only for conditions a snapshot cannot distinguish:

- Transaction fields, such as whether `CredentialIDs` was attached.
- Absent state, such as an unfrozen trust line or whether preauthorization was never granted versus revoked.

Prefer `givenExtra` to `givenOverride`, which replaces all derived conditions.

**Copy Chinese table wording verbatim from the committed `.zh-CN.md` section.** Preserve its English terms, for example `Issuer → Bob USD (mint)` and `Issuer 不受限`; do not translate them again.

## Conventions

- Use XRPL SDK flag constants where available: `RippleStateFlags` and `AccountRootFlags` are exported; MPToken ledger flags are not, and `lsfMPTLocked = 0x1` was confirmed from a live ledger.
- Read trust line state through `ledger_entry` with `ripple_state`; `account_lines` lacks deep-freeze fields, and `LowLimit.issuer` identifies the low side.
- Capture must never fail a test: `captureGiven` falls back to manual conditions on error, and `recordFact` swallows capture errors.
- Preserve `noUncheckedIndexedAccess` and `noUnusedLocals` in `tsconfig.src.json`; handle absent indexed values with `?? fallback`.
- Leave Git write commands to the user; provide the full command instead of executing it.
