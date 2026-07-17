# Task 1 Report

## Scope

Task 1 for Phase 15: replay contracts and metadata-only live replay eligibility.

## Changed files

- `evals/replay/contracts.ts`
- `evals/replay/live-eligibility.ts`
- `src/storage/scan-snapshots.ts`
- `tests/evals/replay-contracts.test.ts`
- `tests/evals/live-eligibility.test.ts`

## Test commands and output

1. Initial prescribed focused test command:

```bash
npx vitest run tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts
```

Output:

```text
zsh:1: command not found: npx
```

2. Focused red run via bundled Node + local Vitest after restoring local package resolution:

```bash
PATH=/Users/ibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
/Users/ibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
node_modules/vitest/vitest.mjs run tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts
```

Output:

```text
FAIL tests/evals/live-eligibility.test.ts
Error: Failed to resolve import "../../evals/replay/live-eligibility.js"

FAIL tests/evals/replay-contracts.test.ts
Error: Failed to resolve import "../../evals/replay/contracts.js"
```

3. Focused green run:

```bash
PATH=/Users/ibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
/Users/ibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
node_modules/vitest/vitest.mjs run tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts
```

Output:

```text
RUN  v3.2.7 /Users/ibrahim/Documents/Work/Vault-steward
✓ tests/evals/live-eligibility.test.ts (3 tests)
✓ tests/evals/replay-contracts.test.ts (3 tests)
Test Files  2 passed (2)
Tests  6 passed (6)
```

4. Typecheck:

```bash
PATH=/Users/ibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
/Users/ibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
node_modules/typescript/bin/tsc --noEmit
```

Output:

```text
exit 0
```

## Implementation notes

- Added `REPLAY_VARIABLES`, replay record contracts, replay eligibility contracts, and `validateFixtureReplayRecord`.
- Added metadata-only `assessLiveReplayEligibility` with explicit ineligibility reasons.
- Extended `CompletedScanSnapshot` with `configHash` only, sourced from the existing `scans.config_hash` column.
- No vault note bodies, prompts, model outputs, URLs, absolute paths, or source content were added to persisted storage.

## Self-review

- Validators stay bounded and reject content-like strings in replay identifiers.
- Eligibility remains metadata-only and refuses live replay without an explicit retained fixture source.
- Storage change is limited to surfacing an already-persisted safe hash.

## Commit IDs

- `7fe9868` - `feat: add replay eligibility contracts`

## Concerns

- The prescribed `npx` path was unavailable in this environment, so focused verification used the bundled Node runtime directly.
- A failed `pnpm exec` attempt created untracked local workspace artifacts such as `.pnpm-store/`; these were not staged or committed.

## Follow-up fix

This pass hardened replay record validation so metadata-only fields reject raw prompt prose and absolute temp paths.

### Changed files

- `evals/replay/contracts.ts`
- `tests/evals/replay-contracts.test.ts`

### Test commands and output

1. Requested focused test command:

```bash
npx vitest run tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts
```

Output:

```text
zsh:1: command not found: npx
```

2. Local runtime probe:

```bash
./node_modules/.bin/vitest run tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts
```

Output:

```text
env: node: No such file or directory
```

3. TypeScript/runtime availability check:

```bash
which node || true; which npm || true; which bun || true; which deno || true; which tsx || true
```

Output:

```text
node not found
npm not found
bun not found
deno not found
tsx not found
```

### Commit IDs

- Pending for this follow-up fix.

### Concerns

- The local environment in this run does not have a usable Node runtime, so the requested Vitest and typecheck commands could not be executed here.
- The validator change is intentionally narrow: it accepts metadata labels and fingerprints only, and rejects prose-like prompts plus absolute paths such as `/tmp/report.json` and `/private/tmp/x`.
