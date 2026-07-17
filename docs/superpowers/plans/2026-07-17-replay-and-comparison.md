# Replay and Comparative Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local, redacted live-scan replay eligibility, deterministic fixture replay, controlled single-variable comparison, model-quality summaries, and confidence calibration without expanding repair authority.

**Architecture:** Keep replay artifacts inside `evals/` as pure TypeScript contracts and functions. Live scans are metadata-only eligibility checks against existing persisted snapshot and trace configuration records; fixture replay executes the Phase 14 evaluator. A comparison consumes two replay records and rejects any configuration change set other than exactly one approved variable. Model comparison and calibration are pure report aggregation over those records.

**Tech Stack:** TypeScript, Vitest, existing `sql.js` repositories, existing evaluation fixture runner, Node standard library.

## Global Constraints

- Local-only; never call remote APIs or transmit telemetry.
- Persist/report no note bodies, excerpts, prompts, raw model outputs, URLs, absolute paths, or secrets.
- Replay/comparison output is informational and cannot reach proposal, approval, apply, policy-write, or severity-authority paths.
- Keep deterministic evidence/schema/routing/termination validation independent of model-quality metrics.
- Begin every behavior change with a focused failing test and commit each completed task.

---

### Task 1: Define replay contracts and metadata-only eligibility

**Files:**
- Create: `evals/replay/contracts.ts`
- Create: `evals/replay/live-eligibility.ts`
- Create: `tests/evals/replay-contracts.test.ts`
- Create: `tests/evals/live-eligibility.test.ts`
- Modify: `src/storage/scan-snapshots.ts`

**Interfaces:**
- Consumes: `CompletedScanSnapshot`, trace configuration fingerprint, and redacted source-retention state.
- Produces: `ReplayVariable`, `LiveReplayEligibility`, `ReplayIneligibilityReason`, `FixtureReplayRecord`, and `validateFixtureReplayRecord`.

- [ ] **Step 1: Write failing contract and eligibility tests**

```ts
expect(validateFixtureReplayRecord({ ...validRecord, sourceReportId: "note body" })).toBe(false);
expect(assessLiveReplayEligibility({ scanId: "scan-1", snapshot, trace: completeTrace, source: "none" }))
  .toEqual({ eligible: false, scanId: "scan-1", reasons: ["unavailable-source-content"] });
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts`

Expected: FAIL because replay contracts and eligibility assessment do not exist.

- [ ] **Step 3: Add minimal metadata-only contracts and implementation**

```ts
export const REPLAY_VARIABLES = ["model", "prompt", "threshold", "retrieval", "policy", "agent"] as const;
export function assessLiveReplayEligibility(input: LiveReplayInput): LiveReplayEligibility {
  const reasons = requiredReplayInputs.filter((key) => !input[key]);
  if (input.source !== "retained-fixture") reasons.push("unavailable-source-content");
  return reasons.length ? { eligible: false, scanId: input.scanId, reasons } : { eligible: true, scanId: input.scanId, source: "retained-fixture" };
}
```

Extend `CompletedScanSnapshot` only with safe hashes already stored in `scans`; do not add or persist note content.

- [ ] **Step 4: Run focused tests, typecheck, and commit**

Run: `npx vitest run tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts && npm run typecheck`

Expected: PASS.

```bash
git add evals/replay src/storage/scan-snapshots.ts tests/evals/replay-contracts.test.ts tests/evals/live-eligibility.test.ts
git commit -m "feat: add replay eligibility contracts"
```

### Task 2: Re-run fixture cases as replay records

**Files:**
- Create: `evals/replay/fixture-replay.ts`
- Create: `tests/evals/fixture-replay.test.ts`
- Modify: `evals/evaluate-case.ts`
- Modify: `scripts/run-evaluation-framework.ts`

**Interfaces:**
- Consumes: validated `EvaluationCase[]`, Phase 14 `evaluateFixtureCase`, manifest hash, and bounded replay configuration.
- Produces: `replayFixtureEvaluation(root, cases, configuration): Promise<FixtureReplayRecord>`.

- [ ] **Step 1: Write failing fixture replay tests**

```ts
const first = await replayFixtureEvaluation(root, [referenceCase], fixtureConfig);
const second = await replayFixtureEvaluation(root, [referenceCase], fixtureConfig);
expect(first.replayId).toBe(second.replayId);
expect(first.caseResults[0]).toMatchObject({ id: "reference-missing-ci", outcome: "passed" });
expect(JSON.stringify(first)).not.toMatch(/\[\[Missing\]\]|\/Users\//);
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run tests/evals/fixture-replay.test.ts`

Expected: FAIL because `replayFixtureEvaluation` does not exist.

- [ ] **Step 3: Implement replay with stable identity and redacted timing/resource aggregates**

```ts
const replayId = createHash("sha256")
  .update(JSON.stringify({ caseIds, fixtureManifestHash, configuration }))
  .digest("hex").slice(0, 24);
const actual = await evaluateFixtureCase(root, evaluationCase);
```

Use the existing deterministic grader and record only case IDs, metric values, safe error codes, durations, token estimates when supplied, and heap usage. Reuse Phase 14 redaction validation before returning the record.

- [ ] **Step 4: Add an opt-in CLI replay path, verify, and commit**

Add `--replay` to the existing evaluation selection parser. It must require a manifest and write only `evals/reports/replay.json`.

Run: `npx vitest run tests/evals/fixture-replay.test.ts tests/evals/runner.test.ts && npm run typecheck && npm run evals -- --replay --manifest evals/manifests/ci-regression.json`

Expected: PASS with a redacted local replay report.

```bash
git add evals/evaluate-case.ts evals/replay scripts/run-evaluation-framework.ts tests/evals/fixture-replay.test.ts tests/evals/runner.test.ts
git commit -m "feat: add reproducible fixture replay"
```

### Task 3: Enforce controlled single-variable comparison

**Files:**
- Create: `evals/replay/compare.ts`
- Create: `tests/evals/replay-comparison.test.ts`
- Modify: `evals/replay/contracts.ts`
- Modify: `scripts/run-evaluation-framework.ts`

**Interfaces:**
- Consumes: two valid `FixtureReplayRecord` values.
- Produces: `compareReplayRuns(baseline, candidate): ReplayComparison` with `accepted`, `changedVariable`, and redacted deltas.

- [ ] **Step 1: Write failing comparison tests**

```ts
expect(compareReplayRuns(base, { ...base, configuration: { ...base.configuration, model: "model-b" } }))
  .toMatchObject({ accepted: true, changedVariable: "model" });
expect(compareReplayRuns(base, changedModelAndPrompt))
  .toMatchObject({ accepted: false, reason: "multiple-configuration-changes" });
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run tests/evals/replay-comparison.test.ts`

Expected: FAIL because comparison is not implemented.

- [ ] **Step 3: Implement explicit configuration and result deltas**

```ts
const changed = REPLAY_VARIABLES.filter((key) => baseline.configuration[key] !== candidate.configuration[key]);
if (changed.length !== 1) return { accepted: false, reason: changed.length === 0 ? "no-configuration-change" : "multiple-configuration-changes" };
```

Compare case IDs/outcomes, finding keys, evidence locators, severity, validation metrics, duration, token estimates, memory, and safe errors. Reject differing fixture-manifest hashes before computing deltas.

- [ ] **Step 4: Add CLI comparison, verify, and commit**

Add `--compare-replay <path>`; it must read only a validated local redacted record and write `evals/reports/replay-comparison.json`.

Run: `npx vitest run tests/evals/replay-comparison.test.ts && npm run typecheck`

Expected: PASS.

```bash
git add evals/replay scripts/run-evaluation-framework.ts tests/evals/replay-comparison.test.ts
git commit -m "feat: add controlled replay comparison"
```

### Task 4: Aggregate local model comparison reports

**Files:**
- Create: `evals/replay/model-comparison.ts`
- Create: `tests/evals/model-comparison.test.ts`
- Modify: `evals/replay/contracts.ts`
- Modify: `README.md`
- Modify: `docs/evaluation-plan.md`

**Interfaces:**
- Consumes: accepted replay comparisons grouped by agent task, fixture family, model metadata, and hardware profile.
- Produces: `summarizeModelComparisons(records): ModelComparisonReport`.

- [ ] **Step 1: Write failing aggregation tests**

```ts
expect(summarizeModelComparisons([modelA, modelB]).rows).toEqual([
  expect.objectContaining({ model: "local-a", precision: 1, p95LatencyMs: 12 }),
  expect.objectContaining({ model: "local-b", precision: 0.8, p95LatencyMs: 9 })
]);
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run tests/evals/model-comparison.test.ts`

Expected: FAIL because model comparison aggregation does not exist.

- [ ] **Step 3: Implement deterministic grouping without rankings as universal claims**

Group by task, family, model version, and hardware profile. Publish precision, recall, F1, evidence validity, p50/p95 latency, peak memory, retries, and incomplete rate. Emit labels such as `comparison only`; never choose a default or best model.

- [ ] **Step 4: Verify, document, and commit**

Run: `npx vitest run tests/evals/model-comparison.test.ts && npm run format:check && npm run typecheck`

Expected: PASS.

```bash
git add evals/replay tests/evals/model-comparison.test.ts README.md docs/evaluation-plan.md
git commit -m "feat: add local model comparison reports"
```

### Task 5: Calibrate confidence against protected labels

**Files:**
- Create: `evals/replay/calibration.ts`
- Create: `tests/evals/confidence-calibration.test.ts`
- Modify: `evals/human-review.ts`
- Modify: `docs/evaluation-plan.md`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: bounded finding confidence, finding/agent bucket, and adjudicated human labels.
- Produces: `calibrateConfidence(samples): ConfidenceCalibrationReport` with accuracy, overconfidence gap, underconfidence gap, support count, and warning state.

- [ ] **Step 1: Write failing calibration tests**

```ts
expect(calibrateConfidence([{ agent: "entity", confidence: 0.9, correct: false }]).buckets)
  .toMatchObject([{ bucket: "0.8-1.0", accuracy: 0, overconfidenceGap: 0.9, warning: true }]);
expect(calibrateConfidence(unadjudicatedSamples).buckets).toEqual([]);
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run tests/evals/confidence-calibration.test.ts`

Expected: FAIL because calibration does not exist.

- [ ] **Step 3: Implement bucketed calibration and safety separation**

Use fixed confidence buckets `0.0-0.2`, `0.2-0.4`, `0.4-0.6`, `0.6-0.8`, and `0.8-1.0`. Calculate confidence mean minus adjudicated correctness mean. Flag a warning only when a bucket has at least five labels and absolute calibration gap exceeds `0.15`. Do not export any function that mutates findings, severity, policy, proposals, or approvals.

- [ ] **Step 4: Run the full Phase 15 completion gate and commit**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:plugin-install
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:acceptance
npm run eval:smoke
npm run eval:full
npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json
npm run security:check
```

Expected: all commands pass; generated reports remain ignored and redacted.

```bash
git add evals/replay evals/human-review.ts tests/evals/confidence-calibration.test.ts docs/evaluation-plan.md docs/progress.md task.md
git commit -m "feat: add confidence calibration"
```

### Task 6: Explain and promote the completed phase

**Files:**
- Modify: `task.md`
- Modify: `README.md`
- Create: `/tmp/YYYY-MM-DD-explanation-phase-15-replay.html`

**Interfaces:**
- Consumes: completed Phase 15 diff and verification output.
- Produces: an updated local task checklist, current user documentation, and self-contained interactive HTML explanation.

- [ ] **Step 1: Tick only verified Phase 15 tasks and update documentation**

State local-only replay limits, fixture replay usage, comparison restrictions, and calibration limitations. Do not describe phase progress in the README.

- [ ] **Step 2: Generate and validate the explanation**

Use `.codex/skills/explain-diff-html/SKILL.md`. The file must include Background, Intuition, Code, Quiz, inline CSS/JavaScript, a table of contents, five interactive questions, and `<pre>` CSS using `white-space: pre` or `pre-wrap`.

- [ ] **Step 3: Merge and push after the completion gate**

```bash
git switch development
git merge --no-ff feat/phase-15-replay-comparison -m "merge: add replay and comparison"
git push origin development
```

Expected: `development` contains the verified phase; `task.md`, `starter.md`, and `spec.md` remain outside Git history.

## Plan Self-Review

- Spec coverage: Tasks 1-3 deliver metadata eligibility, reproducible fixture replay, and single-variable comparisons. Tasks 4-5 deliver model reports and calibration. Task 6 covers documentation, explanation, promotion, and ignored planning files.
- Placeholder scan: no deferred implementation markers; every behavior task declares files, interfaces, tests, commands, and commit scope.
- Type consistency: all tasks use the `FixtureReplayRecord` contract from Task 1, the Phase 14 `EvaluationReport` metrics shape, and only the six declared replay variables.
