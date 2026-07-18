# Phase 16 Advanced Quality and Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic synthetic scale evaluation, optional local retrieval-quality and policy-coverage reports, and verified public documentation without expanding scan or repair authority.

**Architecture:** Pure TypeScript modules under `evals/` create/consume redacted structured inputs. The generator writes only disposable synthetic fixtures; quality evaluators consume metadata and aggregate inputs, and their thin scripts write ignored reports. The README and linked documentation are updated only after their claims are backed by code, tests, a committed baseline, or an existing manual protocol.

**Tech Stack:** TypeScript, Node standard library, Vitest, existing evaluation runner, local JSON reports, Markdown documentation.

## Global Constraints

- Keep SQLite canonical; do not add a vector database, embedding provider, cloud API, telemetry, or remote storage.
- Generated reports and generated vault roots must remain ignored by Git.
- Do not persist/report note bodies, excerpts, prompts, raw model output, URLs, absolute paths, secrets, reviewer IDs, or free-form reviewer labels.
- Retrieval, coverage, calibration, and synthetic-evaluation reports are informational only and must not import or reach findings, proposals, approvals, apply, policy-write, or Obsidian modules.
- Use deterministic seeded generation; reject invalid bounded input before writing files.
- Begin behavior work with focused failing tests and commit every completed task.

---

### Task 1: Create seeded synthetic-vault contracts and generator

**Files:**

- Create: `evals/synthetic/contracts.ts`
- Create: `evals/synthetic/generate.ts`
- Create: `tests/evals/synthetic-generator.test.ts`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: `SyntheticVaultConfig` with a seed, topology counts, and bounded defect rates.
- Produces: `generateSyntheticVault(config): GeneratedSyntheticVault`, with sorted relative Markdown files, a redacted `SyntheticGroundTruth`, and achieved defect counts.

- [ ] **Step 1: Write failing determinism and validation tests**

```ts
const first = generateSyntheticVault(baseConfig);
const second = generateSyntheticVault(baseConfig);
expect(first).toEqual(second);
expect(first.groundTruth.defects).toEqual(
  expect.arrayContaining([expect.objectContaining({ kind: "broken-reference" })])
);
expect(() => generateSyntheticVault({ ...baseConfig, noteCount: 0 })).toThrow("noteCount");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/evals/synthetic-generator.test.ts`

Expected: FAIL because `evals/synthetic/generate.ts` does not exist.

- [ ] **Step 3: Define bounded contracts and implement deterministic generation**

```ts
export type SyntheticDefectKind =
  | "contradiction"
  | "duplicate-entity"
  | "broken-reference"
  | "stale-note"
  | "orphan-task"
  | "schema-violation"
  | "unresolved-decision";

export type SyntheticGroundTruth = {
  schemaVersion: 1;
  seed: string;
  configurationHash: string;
  defects: Array<{ id: string; kind: SyntheticDefectKind; notePath: string; locator: string }>;
};
```

Implement an in-module integer PRNG derived from the seed, rather than using `Math.random`. Build a valid base note set, then inject each defect in a stable order. Use only `Synthetic/` relative paths and stable locators such as `line:4`. Record a defect only after changing the corresponding generated body. Validate all count ceilings and `[0, 1]` rates before generation.

- [ ] **Step 4: Ignore disposable generation output and run focused checks**

Add `evals/generated/` to `.gitignore`. Run:

```bash
npx vitest run tests/evals/synthetic-generator.test.ts
npm run typecheck
```

Expected: PASS; repeated seeded output and ground truth are byte-stable, malformed config is rejected, and no generated path can traverse its root.

- [ ] **Step 5: Commit the generator**

```bash
git add evals/synthetic tests/evals/synthetic-generator.test.ts .gitignore
git commit -m "feat: add seeded synthetic vault generator"
```

### Task 2: Run generated ground truth through a local scale-evaluation CLI

**Files:**

- Create: `evals/synthetic/scale-evaluation.ts`
- Create: `evals/synthetic/configs/small.json`
- Create: `scripts/run-synthetic-scale-eval.ts`
- Create: `tests/evals/synthetic-scale-evaluation.test.ts`
- Modify: `package.json`
- Modify: `docs/evaluation-plan.md`

**Interfaces:**

- Consumes: `GeneratedSyntheticVault` and generated ground truth from Task 1.
- Produces: `evaluateSyntheticScale(generated): SyntheticScaleReport` with generated counts and deterministic precision/recall/F1 metrics.

- [ ] **Step 1: Write a failing evaluation test**

```ts
const generated = generateSyntheticVault({ ...baseConfig, brokenReferenceRate: 1 });
const report = evaluateSyntheticScale(generated);
expect(report).toMatchObject({ schemaVersion: 1, generatedFileCount: 8 });
expect(report.metrics).toMatchObject({ precision: 1, recall: 1, f1: 1 });
expect(JSON.stringify(report)).not.toMatch(/\/Users\/|https?:\/\/|note body/i);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/evals/synthetic-scale-evaluation.test.ts`

Expected: FAIL because `evaluateSyntheticScale` does not exist.

- [ ] **Step 3: Implement scale evaluation and report writing**

Use the existing deterministic reference evaluator against a temporary generated root. Match findings to ground truth by defect kind and relative locator. Return only count aggregates, stable IDs, metrics, generation duration, and manifest hash. The CLI must load a bounded JSON configuration from `evals/synthetic/configs/`, write `evals/reports/synthetic-scale.json`, and never read an Obsidian vault.

```ts
export type SyntheticScaleReport = {
  schemaVersion: 1;
  configurationHash: string;
  generatedFileCount: number;
  achievedDefectCounts: Record<SyntheticDefectKind, number>;
  metrics: { precision: number; recall: number; f1: number };
};
```

Add `"eval:synthetic": "tsx scripts/run-synthetic-scale-eval.ts"` to `package.json`.

- [ ] **Step 4: Verify the local CLI**

Run:

```bash
npx vitest run tests/evals/synthetic-generator.test.ts tests/evals/synthetic-scale-evaluation.test.ts
npm run typecheck
npm run eval:synthetic
```

Expected: PASS; the CLI prints a redacted report summary and creates only ignored generated/report artifacts.

- [ ] **Step 5: Commit the scale evaluation**

```bash
git add evals/synthetic scripts/run-synthetic-scale-eval.ts tests/evals/synthetic-scale-evaluation.test.ts package.json docs/evaluation-plan.md
git commit -m "feat: add synthetic scale evaluation"
```

### Task 3: Measure optional retrieval quality without granting authority

**Files:**

- Create: `evals/retrieval/contracts.ts`
- Create: `evals/retrieval/evaluate.ts`
- Create: `tests/evals/retrieval-quality.test.ts`
- Modify: `docs/evaluation-plan.md`
- Modify: `docs/architecture.md`

**Interfaces:**

- Consumes: `RetrievalEvent[]` and `RetrievalExpectation[]` containing bounded IDs, finite scores, cache states, and duration.
- Produces: `evaluateRetrievalQuality(events, expectations): RetrievalQualityReport`.

- [ ] **Step 1: Write failing retrieval-quality tests**

```ts
const report = evaluateRetrievalQuality(
  [
    {
      queryId: "q1",
      requestedK: 2,
      candidates: [{ evidenceId: "e1", score: 0.9 }],
      cache: "hit",
      durationMs: 5
    }
  ],
  [{ queryId: "q1", relevantEvidenceIds: ["e1"] }]
);
expect(report).toMatchObject({
  status: "measured",
  coverage: 1,
  relevanceRate: 1,
  cacheHitRate: 1,
  p95LatencyMs: 5
});
expect(evaluateRetrievalQuality([], [])).toMatchObject({
  status: "not-configured",
  coverage: null
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/evals/retrieval-quality.test.ts`

Expected: FAIL because the retrieval evaluator does not exist.

- [ ] **Step 3: Implement pure validation and aggregate metrics**

```ts
export type RetrievalQualityReport = {
  schemaVersion: 1;
  status: "not-configured" | "measured";
  coverage: number | null;
  relevanceRate: number | null;
  cacheHitRate: number | null;
  score: { min: number; max: number; mean: number } | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  missingQueryCount: number;
};
```

Reject duplicate query IDs, duplicate candidate evidence IDs per query, score values outside finite numeric range, `requestedK` mismatches, invalid cache values, unsafe identifiers, and expectations with duplicate relevant evidence IDs. A no-event/no-expectation input returns `not-configured`; any other empty/inconsistent combination fails closed. Do not import from `src/findings`, `src/review`, `src/policy`, `src/plugin`, or Obsidian.

- [ ] **Step 4: Run focused and boundary checks**

Run:

```bash
npx vitest run tests/evals/retrieval-quality.test.ts
npm run typecheck
rg -n "src/(findings|review|policy|plugin)|obsidian" evals/retrieval
```

Expected: tests/typecheck pass and the search has no matches.

- [ ] **Step 5: Commit retrieval evaluation**

```bash
git add evals/retrieval tests/evals/retrieval-quality.test.ts docs/evaluation-plan.md docs/architecture.md
git commit -m "feat: add retrieval quality evaluation"
```

### Task 4: Summarize policy coverage from aggregate local records

**Files:**

- Create: `evals/policy-coverage/contracts.ts`
- Create: `evals/policy-coverage/summarize.ts`
- Create: `tests/evals/policy-coverage.test.ts`
- Modify: `docs/evaluation-plan.md`

**Interfaces:**

- Consumes: safe `PolicyCoverageDefinition[]`, `PolicyCoverageExecution[]`, `PolicyCoverageFixture[]`, and aggregate `PolicyCoverageReview[]`.
- Produces: `summarizePolicyCoverage(input): PolicyCoverageReport` with one deterministic row per policy/version.

- [ ] **Step 1: Write failing status-precedence tests**

```ts
const report = summarizePolicyCoverage({
  definitions: [{ policyId: "tasks", version: "v1", deprecated: false }],
  executions: [],
  fixtures: [],
  reviews: []
});
expect(report.rows).toEqual([
  expect.objectContaining({
    policyId: "tasks",
    status: "unexercised",
    reviewerFalsePositiveRate: null
  })
]);
```

Add cases proving `deprecated` wins over every other status, a policy with runs but no fixture is `missing-fixture`, and reviewer false-positive rate is distinct from missing review data.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/evals/policy-coverage.test.ts`

Expected: FAIL because policy coverage modules do not exist.

- [ ] **Step 3: Implement aggregate-only coverage report**

```ts
export type PolicyCoverageStatus =
  "covered" | "unexercised" | "missing-fixture" | "review-needed" | "deprecated";

export type PolicyCoverageRow = {
  policyId: string;
  version: string;
  executedCount: number;
  triggeredCount: number;
  fixtureCoverage: boolean;
  reviewerFalsePositiveRate: number | null;
  deprecated: boolean;
  status: PolicyCoverageStatus;
  suggestion: "none" | "add-fixture" | "review-false-positives" | "remove-deprecated";
};
```

Accept only bounded IDs/versions and non-negative aggregate counts. Compute statuses in this fixed order: deprecated, unexercised, missing fixture, review needed, covered. A review is needed only where reviewer feedback exists and its false-positive rate is at least 0.2. Do not include reviewer ID, finding ID, label text, policy YAML, or an update method.

- [ ] **Step 4: Verify report safety and determinism**

Run:

```bash
npx vitest run tests/evals/policy-coverage.test.ts
npm run typecheck
rg -n "reviewerId|findingId|label|savePolicy|write" evals/policy-coverage
```

Expected: tests/typecheck pass and the safety search has no matches.

- [ ] **Step 5: Commit policy coverage**

```bash
git add evals/policy-coverage tests/evals/policy-coverage.test.ts docs/evaluation-plan.md
git commit -m "feat: add policy coverage reports"
```

### Task 5: Publish verified public documentation and documentation checks

**Files:**

- Create: `EVALS.md`
- Create: `OBSERVABILITY.md`
- Create: `PRIVACY.md`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `ROADMAP.md`
- Create: `CHANGELOG.md`
- Create: `docs/local-models.md`
- Create: `docs/troubleshooting.md`
- Create: `docs/release-compatibility.md`
- Create: `tests/docs/public-documentation.test.ts`
- Modify: `README.md`
- Modify: `docs/progress.md`
- Modify: `task.md`

**Interfaces:**

- Consumes: existing package scripts, architecture/security/runbook documents, release manifest tests, and Phase 16 report contracts.
- Produces: verified public documentation with a static documentation test.

- [ ] **Step 1: Write a failing documentation contract test**

```ts
expect(readme).toContain("## Privacy And Safety");
for (const file of requiredPublicDocs) expect(existsSync(resolve(root, file))).toBe(true);
expect(readme).not.toMatch(/Phase 1[0-9]/i);
expect(readme).not.toMatch(/Community Plugins/i);
expect(documentedCommands).toEqual(expect.arrayContaining(["npm run eval:synthetic"]));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/docs/public-documentation.test.ts`

Expected: FAIL because the public-document inventory is incomplete.

- [ ] **Step 3: Write concise, evidence-backed documentation**

Rewrite the README around product positioning, problem, workflow, local trust boundary, bounded multi-agent architecture, installation, local setup, evaluation/observability, limitations, commands, and contribution links. Link every required file. Keep detailed storage/privacy, model, troubleshooting, security, roadmap, changelog, and compatibility content in its named document. Use only currently supported manual installation and tested local-provider guidance. Record the dated documentation acceptance in `docs/progress.md`; tick only completed Phase 16 items in ignored `task.md` after all checks pass.

- [ ] **Step 4: Make the documentation test enforce truthful claims**

The test must parse README links, verify each local target exists, compare command code spans to `package.json` scripts or allowlisted manual commands, reject phase-progress prose, remote telemetry claims, marketplace installation claims, and unlinked required documents. Run:

```bash
npx vitest run tests/docs/public-documentation.test.ts
npm run format:check
npm run typecheck
```

Expected: PASS; docs contain no claim that cannot be verified from the repository.

- [ ] **Step 5: Commit public documentation**

```bash
git add README.md EVALS.md OBSERVABILITY.md PRIVACY.md SECURITY.md CONTRIBUTING.md ROADMAP.md CHANGELOG.md docs tests/docs/public-documentation.test.ts docs/progress.md task.md
git commit -m "docs: publish verified project documentation"
```

### Task 6: Verify, explain, and promote Phase 16

**Files:**

- Modify: `task.md`
- Create: `/tmp/YYYY-MM-DD-explanation-phase-16-quality.html`

**Interfaces:**

- Consumes: verified Phase 16 diff and command output.
- Produces: a ticked local task tracker, interactive explanation, and promoted `development` branch.

- [ ] **Step 1: Run focused and full completion checks**

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
npm run eval:synthetic
npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json
npm run perf:smoke
npm run ops:smoke
npm run security:check
```

Expected: all commands pass. Reports remain ignored and no product authority surface changed.

- [ ] **Step 2: Generate and validate the explanation**

Use `.codex/skills/explain-diff-html/SKILL.md` to create `/tmp/YYYY-MM-DD-explanation-phase-16-quality.html`. Include Background, Intuition, Code, Quiz, table of contents, inline CSS/JavaScript, five interactive answers, and `<pre>` styling with `white-space: pre` or `pre-wrap`.

- [ ] **Step 3: Merge and push**

```bash
git switch development
git merge --no-ff feat/phase-16-advanced-quality -m "merge: add advanced quality coverage"
git push origin development
```

Expected: `development` contains the verified phase; `task.md`, `starter.md`, and `spec.md` remain outside Git history.

## Plan Self-Review

- **Spec coverage:** Tasks 1-2 implement seeded ground truth and scale evaluation. Task 3 implements optional retrieval metrics and the authority boundary. Task 4 implements policy coverage and aggregate feedback privacy. Task 5 implements the README and all linked documents with a truthful-claims check. Task 6 runs the required completion gate, explanation, and promotion.
- **Placeholder scan:** No deferred implementation markers are used; every task defines concrete files, interfaces, test examples, commands, and commit scope.
- **Type consistency:** Task 2 consumes Task 1's `GeneratedSyntheticVault`; Task 3 and Task 4 are standalone pure report contracts; Task 5 consumes verified scripts/contracts without duplicating their authority.
