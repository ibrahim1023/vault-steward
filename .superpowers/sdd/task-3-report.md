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
