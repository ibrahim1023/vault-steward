# Task 3 Report: Controlled Single-Variable Replay Comparison

Date: 2026-07-17
Branch: feat/phase-15-replay-comparison
Status: Implemented and verified

## Scope

Implemented controlled replay comparison for redacted fixture replay records and added CLI support for comparing a new replay run against a validated local baseline record.

## Changed Files

- `evals/replay/compare.ts`
  - Added `compareReplayRuns(baseline, candidate)` with strict single-variable enforcement.
  - Rejects fixture manifest mismatches before diffing.
  - Produces redacted deltas for case membership, outcome changes, duration changes, safe error-code changes, aggregate metric deltas, and runtime deltas.
- `evals/replay/contracts.ts`
  - Added replay comparison result and diff types.
- `scripts/run-evaluation-framework.ts`
  - Added `--compare-replay <path>` handling without modifying shared selection parsing.
  - Reads only validated local `FixtureReplayRecord` JSON.
  - Writes `evals/reports/replay-comparison.json`.
- `tests/evals/replay-comparison.test.ts`
  - Preserved the existing untracked paused-work test and built the implementation to satisfy it.

## Red-Green Commands

Red:

```bash
npx vitest run tests/evals/replay-comparison.test.ts
```

Observed failure:

- import resolution failure for `../../evals/replay/compare.js` because the comparison module did not exist yet.

Green:

```bash
npx vitest run tests/evals/replay-comparison.test.ts
```

Result:

- PASS after implementing `evals/replay/compare.ts` and comparison contract types.

Focused verification:

```bash
npx vitest run tests/evals/replay-contracts.test.ts tests/evals/replay-comparison.test.ts
npm run typecheck
```

Result:

- PASS

Direct CLI verification:

```bash
npm run evals -- --replay --manifest evals/manifests/ci-regression.json
cp evals/reports/replay.json evals/reports/replay-baseline.json
npm run evals -- --replay --manifest evals/manifests/ci-regression.json --model-profile replay-model-b --compare-replay evals/reports/replay-baseline.json
```

Result:

- PASS
- `evals/reports/replay-comparison.json` written with `accepted: true` and `changedVariable: "model"`.

## Behavioral Notes

- Comparison accepts exactly one changed replay configuration variable from `REPLAY_VARIABLES`.
- Comparison rejects:
  - `fixture-manifest-mismatch`
  - `no-configuration-change`
  - `multiple-configuration-changes`
- Error-code diffing stays redacted and limited to:
  - newly introduced candidate-only error codes
  - changed error codes for shared case IDs
- CLI comparison path is restricted to local relative workspace paths and validated replay records.

## Concerns

- `tsx` needed sandbox escalation for direct CLI verification because it attempted to create its local IPC pipe outside the sandbox allowance. The implementation itself does not introduce any remote or non-local behavior.
- The comparison report intentionally stays aggregate and redacted because Task 1/2 replay records do not carry finding-level payloads beyond safe case/error summaries and aggregate metrics.

## Commit

- Branch: `feat/phase-15-replay-comparison`
- Commit message: `feat: add controlled replay comparison`

## 2026-07-17 Review Fix Follow-Up

Scope remained limited to replay contracts, replay generation, replay comparison, focused tests, and this appended report.

### Review Findings Addressed

- Added a strictly redacted per-finding replay result shape on each case result:
  - `findingKey`
  - `evidence.notePath`
  - `evidence.locator`
  - `severity`
  - `validation.supported`
  - `validation.schemaValid`
  - `validation.routeValid`
  - `validation.terminated`
- Fixture replay now derives these finding results directly from evaluator output without storing note content.
- Replay comparison now emits finding-level deltas for:
  - added findings
  - removed findings
  - evidence changes
  - severity changes
  - validation changes
- Corrected `failureDiff` so it records:
  - removed-case error codes in `removed`
  - cleared shared-case errors in `removed`
  - per-case code transitions in `changed`
  - without silently omitting removals
- Replaced numeric-only metric/token diffs with explicit transition objects:
  - `{ baseline: number | null, candidate: number | null, delta: number | null }`
  - null-to-number and number-to-null transitions are now preserved instead of being dropped

### Red-Green Verification

Failing tests were added first in:

- `tests/evals/fixture-replay.test.ts`
- `tests/evals/replay-comparison.test.ts`

Observed initial failures:

- replay records did not include per-finding results
- comparison did not report corrected removed failures or explicit nullable transitions

Passing verification after implementation:

```bash
npx vitest run tests/evals/fixture-replay.test.ts
npx vitest run tests/evals/replay-comparison.test.ts
npm run typecheck
```

Result:

- PASS

### Direct CLI Verification

Commands run on Friday, July 17, 2026:

```bash
npm run evals -- --replay --manifest evals/manifests/ci-regression.json
cp evals/reports/replay.json evals/reports/replay-baseline.json
npm run evals -- --replay --manifest evals/manifests/ci-regression.json --model-profile replay-model-b --compare-replay evals/reports/replay-baseline.json
```

Result:

- PASS
- `evals/reports/replay-comparison.json` written successfully
- output shows `accepted: true` and `changedVariable: "model"`
- the current deterministic fixture manifest produced no finding, failure, or metric deltas for the model-label-only comparison, which is consistent with the fixture behavior

### Notes

- `tsx` still required sandbox escalation for CLI verification because it creates an IPC pipe outside the default sandbox allowance.
- No unrelated files were reverted or modified.
