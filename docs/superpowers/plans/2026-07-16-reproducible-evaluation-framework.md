# Reproducible Evaluation and Regression Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad hoc deterministic eval inputs with validated fixture cases, redacted reports, selective local execution, and reproducible regression gates.

**Architecture:** `evals/contracts.ts` owns runtime-safe case/report types; fixture loading and pure grading live in `evals/`; `scripts/run-evals.ts` is a thin typed CLI and report writer. Existing JSONL suites remain compatible while case manifests become the canonical route for all new coverage.

**Tech Stack:** TypeScript, Node.js 20, Vitest, existing `tsx` runner, deterministic local fixture vaults.

## Global Constraints

- Default evaluation never calls a local provider, network service, or cloud API.
- Reports contain only IDs, aggregate metrics, safe codes, and bounded metadata; no note body, prompt, raw output, secret, URL, or absolute path.
- Default selection excludes held-out and human-review cases.
- Deterministic evidence/schema/policy checks are mandatory; model-as-judge cannot be a safety gate.
- Do not add a plugin UI, SQLite migration, or external dependency.

---

### Task 1: Evaluation Contracts and Fixture Loader

**Files:**

- Create: `evals/contracts.ts`
- Create: `evals/fixtures.ts`
- Create: `tests/evals/contracts.test.ts`
- Create: `tests/evals/fixtures.test.ts`

**Interfaces:**

- Produces `EvaluationCase`, `EvaluationReport`, `validateEvaluationCase`, `validateEvaluationReport`, and `loadEvaluationCases`.

- [ ] **Step 1: Write failing validation and fixture tests**

```ts
expect(validateEvaluationCase(validCase)).toBe(true);
expect(validateEvaluationCase({ ...validCase, fixturePath: "../vault" })).toBe(false);
await expect(loadEvaluationCases(root, { split: ["development"] })).resolves.toHaveLength(1);
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run tests/evals/contracts.test.ts tests/evals/fixtures.test.ts`

- [ ] **Step 3: Implement bounded contracts and repository-relative fixture loading**

```ts
export function validateEvaluationCase(value: unknown): value is EvaluationCase {
  /* exact split/path/content checks */
}
export async function loadEvaluationCases(
  root: string,
  selection: Selection
): Promise<EvaluationCase[]> {
  /* manifest + metadata + expected */
}
```

- [ ] **Step 4: Run focused tests and commit**

Run: `npx vitest run tests/evals/contracts.test.ts tests/evals/fixtures.test.ts`

Commit: `git commit -m "feat: add evaluation case contracts"`

### Task 2: Shared Metrics and Deterministic Family Fixtures

**Files:**

- Create: `evals/graders/metrics.ts`
- Modify: `evals/graders/model-quality.ts`
- Create: `evals/cases/` fixture directories and `evals/manifests/*.json`
- Create: `tests/evals/metrics.test.ts`
- Modify: `tests/evals/model-quality.test.ts`

**Interfaces:**

- Consumes Task 1 cases.
- Produces `gradeExpectedFindings`, `EvaluationMetrics`, and manifests covering reference, entity, contradiction, staleness, task, schema, policy, and decision families.

- [ ] **Step 1: Write failing grading tests**

```ts
expect(gradeExpectedFindings(expected, actual)).toMatchObject({
  precision: 1,
  recall: 1,
  sourceRangeAccuracy: 1
});
expect(gradeExpectedFindings([], [])).toMatchObject({ precision: null, recall: null });
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/evals/metrics.test.ts tests/evals/model-quality.test.ts`

- [ ] **Step 3: Implement shared metrics and fixture coverage**

Implement explicit null denominators, evidence/source-range and severity metrics, unsupported claims, schema/routing/termination compliance, and deterministic safe-fix validity. Give every family one valid fixture and one constrained/reject fixture across development, CI, held-out, adversarial, or human-review splits.

- [ ] **Step 4: Run focused tests and commit**

Run: `npx vitest run tests/evals/metrics.test.ts tests/evals/model-quality.test.ts`

Commit: `git commit -m "feat: add deterministic evaluation metrics"`

### Task 3: Selection CLI and Redacted Report Writer

**Files:**

- Create: `evals/runner.ts`
- Modify: `scripts/run-evals.ts`
- Modify: `package.json`
- Create: `tests/evals/runner.test.ts`

**Interfaces:**

- Consumes Task 1 loader and Task 2 graders.
- Produces `parseEvaluationSelection`, `runEvaluation`, and `writeEvaluationReport` with suite/agent/model-profile/case/split/manifest filters.

- [ ] **Step 1: Write failing runner tests**

```ts
expect(parseEvaluationSelection(["--split", "held-out"])).toMatchObject({ splits: ["held-out"] });
expect(() => parseEvaluationSelection(["--case", "unknown"])).toThrow("Unknown evaluation case");
expect(JSON.stringify(report)).not.toContain("note body");
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/evals/runner.test.ts`

- [ ] **Step 3: Implement deterministic selection and report provenance**

The default selects development and CI only; held-out/human review require explicit split. Report provenance includes plugin/parser/grader/manifest/config fingerprints and bounded hardware metadata. `--model-profile` is metadata only.

- [ ] **Step 4: Run focused tests and commit**

Run: `npx vitest run tests/evals/runner.test.ts && npm run evals -- --suite reference --split ci-regression`

Commit: `git commit -m "feat: add filtered evaluation reports"`

### Task 4: Baseline Comparison and Dataset Governance

**Files:**

- Create: `evals/regression.ts`
- Create: `evals/baselines/evaluation-main.json`
- Create: `evals/baselines/evaluation-main.rationale.json`
- Create: `tests/evals/regression.test.ts`
- Modify: `.github/workflows/verify.yml`

**Interfaces:**

- Consumes Task 3 reports.
- Produces `compareEvaluationReports` and `assertDatasetGovernance`.

- [ ] **Step 1: Write failing regression/governance tests**

```ts
expect(compareEvaluationReports(baseline, regressed)).toContain("precision dropped");
expect(() => assertDatasetGovernance(developmentSelection, heldOutCase)).toThrow("held-out");
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/evals/regression.test.ts`

- [ ] **Step 3: Implement threshold/rationale and manifest protections**

Gate critical-case failures, validity, unsupported claims, precision/recall/F1 and comparable latency/memory changes. A baseline update requires a bounded rationale with author, date, affected metrics, and review reason. CI runs the deterministic CI manifest only.

- [ ] **Step 4: Run focused tests and commit**

Run: `npx vitest run tests/evals/regression.test.ts && npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json`

Commit: `feat: add evaluation regression gates`

### Task 5: Completion and Promotion

**Files:**

- Modify: `task.md` (ignored local tracker)
- Modify: `docs/progress.md`
- Modify: `README.md` when public behavior changes
- Create: `/tmp/2026-07-16-explanation-phase-14-evaluations.html`

- [ ] **Step 1: Run full completion gate**

Run: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run test:acceptance`, `npm run eval:smoke`, `npm run eval:full`, and `npm run security:check`.

- [ ] **Step 2: Update records and generate explanation**

Tick only verified Phase 14 tasks, record actual gate results, and create the required self-contained HTML explanation with inline CSS/JavaScript, diagrams, and five interactive questions.

- [ ] **Step 3: Commit, merge, and push**

Commit: `git commit -m "docs: complete phase 14 evaluation framework"`, merge into `development`, and push `origin/development`.
