# Unified Findings and Safe Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current governed scan into a persisted, evidence-backed review workspace that presents deterministic and local-model findings, and lets a user safely review and apply deterministic reference repairs.

**Architecture:** Preserve the existing split between the Obsidian adapter and the TypeScript core. A new core scan orchestrator consumes one immutable scanner snapshot, produces normalized findings from deterministic checks and citation-validated model candidates, and persists those records through SQLite. The React workspace reads a query model and invokes only an explicit review workflow; model output never reaches a write path.

**Tech Stack:** TypeScript, React, Obsidian Plugin API, sql.js, Vitest, Testing Library, local Ollama or llama.cpp through the existing `LocalProvider` interface.

## Global Constraints

- Work on `feat/phase-7-unified-findings-review` created from `development`; promote only after the Phase 7 completion gate passes.
- Offline only: no telemetry, cloud APIs, remote storage, shell execution, or non-loopback model endpoints.
- SQLite remains the canonical local state; model outputs remain candidates until deterministic evidence validation and finding normalization complete.
- A governed scan requires the existing local model stage to complete; provider/model failure stays visibly incomplete and cannot become a deterministic-only success.
- Notes are untrusted data. Diagnostics, traces, and UI errors must not expose prompts, secrets, or absolute vault paths.
- Apply remains available only for an explicitly approved, revision-checked deterministic proposal and must record an audit action before reporting success.
- Use test-first changes, run focused tests before broad gates, update `docs/interfaces.md`, `docs/architecture.md`, `docs/ai-system.md`, `docs/testing-strategy.md`, and `docs/progress.md` when their authority changes, and commit each completed task.

---

## File Structure

- `src/contracts/index.ts`: expanded public finding types and shared finding payload contracts.
- `src/scanner/scan.ts`: scan records retain parsed frontmatter needed by deterministic adapters.
- `src/findings/normalize.ts`: converts deterministic issues and validated agent candidates into bounded `Finding` values.
- `src/core/governed-scan.ts`: core-only orchestrator that builds agent inputs, gathers checks, normalizes findings, and returns a scan result.
- `src/storage/repositories.ts`: typed query methods for persisted scan/findings/proposals without raw SQL in UI code.
- `src/plugin/database.ts`: Obsidian-facing local database lifecycle and migration boundary.
- `src/plugin/main.ts`: delegates live files to the core orchestrator and exposes review actions through narrow callbacks.
- `src/ui/ReviewQueueView.tsx`, `src/ui/ProposalReviewPanel.tsx`, `src/ui/VaultStewardWorkspace.tsx`: persisted review queue, diff/proposal controls, and safe state handling.
- `tests/findings/normalize.test.ts`, `tests/core/governed-scan.test.ts`, `tests/integration/persisted-review-queue.test.ts`, `tests/ui/proposal-review-panel.test.tsx`, and `tests/e2e/persisted-review-workspace.test.tsx`: deterministic, integration, UI, and end-to-end coverage.

## Task 1: Version the Unified Finding Contract

**Files:**

- Modify: `src/contracts/index.ts`, `docs/interfaces.md`, `docs/architecture.md`
- Create: `src/findings/normalize.ts`, `tests/findings/normalize.test.ts`, `docs/adr/0005-unified-findings.md`

**Interfaces:**

- Produces `FindingType` values for `broken-reference`, `invalid-reference`, `entity-alias`, `contradiction`, `staleness`, `task`, `schema`, `decision`, and `policy`.
- Produces `normalizeFinding(input: NormalizedFindingInput): Finding | null`, returning `null` for invalid confidence, missing evidence, unsupported type, or evidence not present in the scan.

- [x] **Step 1: Write failing normalization tests**

```ts
expect(
  normalizeFinding({ type: "entity-alias", evidence: [first, second], confidence: 0.8 })
).toMatchObject({ type: "entity-alias", status: "open" });
expect(normalizeFinding({ type: "contradiction", evidence: [], confidence: 0.8 })).toBeNull();
```

- [x] **Step 2: Run the focused test to confirm the contract is absent**

Run: `npx vitest run tests/findings/normalize.test.ts`

Expected: FAIL because the expanded finding types and `normalizeFinding` do not yet exist.

- [x] **Step 3: Define the minimal versioned input and normalization implementation**

```ts
export type NormalizedFindingInput = {
  scanId: string;
  type: FindingType;
  evidence: readonly EvidenceRef[];
  explanation: string;
  confidence: number;
  severity: FindingSeverity;
  violatedPolicyId?: string;
};

export function normalizeFinding(input: NormalizedFindingInput): Finding | null {
  if (input.evidence.length === 0 || input.confidence < 0 || input.confidence > 1) return null;
  return {
    schemaVersion: 1,
    id: stableFindingId(input),
    status: "open",
    affectedNoteIds: uniquePaths(input.evidence),
    suggestedFixes: [],
    ...input
  };
}
```

- [x] **Step 4: Update the ADR and interface authority**

Document that model candidate labels are mapped to typed findings only by `src/findings/normalize.ts`, and that unknown candidate shapes are discarded.

- [x] **Step 5: Verify and commit**

Run: `npm run test:unit && npm run typecheck`

Expected: PASS, with no raw model output exposed as a `Finding`.

Commit:

```bash
git add src/contracts/index.ts src/findings/normalize.ts tests/findings/normalize.test.ts docs/interfaces.md docs/architecture.md docs/adr/0005-unified-findings.md
git commit -m "feat: add unified finding contract"
```

## Task 2: Build One Snapshot-Derived Governed Scan Pipeline

**Files:**

- Modify: `src/scanner/scan.ts`, `src/plugin/main.ts`, `tests/e2e/governed-scan.test.ts`
- Create: `src/core/governed-scan.ts`, `tests/core/governed-scan.test.ts`

**Interfaces:**

- Produces `runGovernedScan(files, providers, now): Promise<GovernedScanResult>`.
- `GovernedScanResult` contains `scanId`, normalized `findings`, bounded `modelTraces`, `limitations`, and `completed`.
- Consumes the scanner snapshot once; all agent evidence, task/schema/decision/policy checks, and reference checks originate from that snapshot.

- [ ] **Step 1: Write a failing cross-family scan test**

```ts
const result = await runGovernedScan(
  filesWithMissingLinkAndOldTask,
  [provider],
  "2026-07-14T00:00:00Z"
);
expect(result.findings.map((finding) => finding.type)).toContain("broken-reference");
expect(result.findings.map((finding) => finding.type)).toContain("task");
expect(result.completed).toBe(true);
```

- [ ] **Step 2: Run the focused test to confirm the current reference-only result fails**

Run: `npx vitest run tests/core/governed-scan.test.ts`

Expected: FAIL because `runGovernedScan` and snapshot-derived non-reference inputs do not exist.

- [ ] **Step 3: Retain parsed frontmatter and derive bounded inputs**

```ts
export type ScannedNote = {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  revision: string;
  headings: string[];
  references: ParsedReference[];
};

const agentEvidence = snapshot.notes.map((note) => ({
  notePath: note.path,
  locator: "line:1",
  excerpt: note.content.slice(0, 2_000)
}));
```

Derive tasks, schemas, decisions, policy facts, contradiction propositions, and staleness records deterministically. Pass only validated, capped evidence to the existing coordinator.

- [ ] **Step 4: Normalize all deterministic and validated semantic outputs**

Use `normalizeFinding` for every issue family. Return a visible incomplete result on model failure and do not persist partial semantic findings as a completed governed scan.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit && npm run test:e2e && npm run eval:smoke && npm run typecheck`

Expected: PASS; the reference-only governed-scan test is replaced by a snapshot-derived multi-family fixture.

Commit:

```bash
git add src/scanner/scan.ts src/core/governed-scan.ts src/plugin/main.ts tests/core/governed-scan.test.ts tests/e2e/governed-scan.test.ts
git commit -m "feat: unify governed scan findings"
```

## Task 3: Persist Scans, Findings, and Safe Query Models

**Files:**

- Modify: `src/storage/repositories.ts`, `src/storage/migrations.ts`, `src/main.ts`, `docs/reliability.md`
- Create: `src/plugin/database.ts`, `tests/integration/persisted-review-queue.test.ts`, `tests/plugin/database.test.ts`

**Interfaces:**

- Produces `listFindings(filter: FindingQuery): FindingRecord[]`, `findProposal(id: string): ProposalRecord | null`, and a plugin-local database lifecycle that migrates before scans.
- `FindingQuery` permits `scanId`, type, severity, status, policy ID, and minimum confidence; it never accepts arbitrary SQL or a note-content search string.

- [ ] **Step 1: Write failing persistence and recovery tests**

```ts
repository.saveFinding(record);
expect(repository.listFindings({ scanId: "scan-1", status: "open" })).toHaveLength(1);
expect(recoverDatabaseAfterInterruptedScan(database)).toEqual({ recoveredScans: 1 });
```

- [ ] **Step 2: Run focused integration tests**

Run: `npx vitest run tests/integration/persisted-review-queue.test.ts tests/plugin/database.test.ts`

Expected: FAIL because query methods and the plugin database lifecycle do not exist.

- [ ] **Step 3: Add typed repository queries and database initialization**

```ts
export type FindingQuery = {
  scanId?: string;
  type?: FindingType;
  severity?: FindingSeverity;
  status?: FindingStatus;
  policyId?: string;
  minimumConfidence?: number;
};

export function openPluginDatabase(adapter: PluginDataAdapter): PluginDatabase {
  // read bounded local bytes, reject corrupt non-SQLite input, apply migrations, recover interrupted work
}
```

The adapter remains the only Obsidian-aware storage boundary; core scan code receives repositories through explicit interfaces.

- [ ] **Step 4: Save model trace metadata and final scan state atomically**

Persist only provider/model identifiers, duration, counts, outcome, and correlation ID. Do not persist prompts or evidence excerpts in model trace rows.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit && npm run test:integration && npm run security:check`

Expected: PASS; recovery marks interrupted scans safely and query filters return only allowed persisted fields.

Commit:

```bash
git add src/storage/repositories.ts src/storage/migrations.ts src/plugin/database.ts src/main.ts tests/integration/persisted-review-queue.test.ts tests/plugin/database.test.ts docs/reliability.md
git commit -m "feat: persist governed review queue"
```

## Task 4: Render a Persisted Evidence-First Review Queue

**Files:**

- Modify: `src/ui/ReviewQueueView.tsx`, `src/ui/VaultStewardWorkspace.tsx`, `src/main.ts`, `docs/accessibility-review.md`
- Create: `tests/ui/persisted-review-queue.test.tsx`, `tests/e2e/persisted-review-workspace.test.tsx`

**Interfaces:**

- `VaultStewardWorkspace` receives `scan(): Promise<ReviewWorkspaceState>` and `loadFindings(filter: ReviewFilter): Promise<Finding[]>`.
- `ReviewWorkspaceState` reports `scanId`, `completed`, `limitations`, and safe diagnostics separately from findings.

- [ ] **Step 1: Write failing UI tests for finding type and incomplete scan state**

```tsx
render(<VaultStewardWorkspace scan={scan} loadFindings={loadFindings} />);
expect(await screen.findByText("entity-alias")).toBeInTheDocument();
expect(screen.getByText("Semantic analysis needs attention")).toBeInTheDocument();
```

- [ ] **Step 2: Run focused UI tests**

Run: `npx vitest run tests/ui/persisted-review-queue.test.tsx tests/e2e/persisted-review-workspace.test.tsx`

Expected: FAIL because the workspace currently accepts only an in-memory findings array.

- [ ] **Step 3: Implement query-backed states and provenance**

Render finding type, severity, confidence, policy ID, evidence locators, source scan, and candidate limitations. Use native labelled controls, `role="status"` for progress, `role="alert"` for failures, and no custom keyboard-only widgets.

- [ ] **Step 4: Preserve readable narrow-pane behavior**

Keep long note paths and evidence in semantic blocks; use `pre` for source-preserving diff text; never truncate the only evidence locator.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit && npm run test:e2e && npm run typecheck`

Expected: PASS; a restarted view can reload persisted findings and exposes incomplete model analysis without presenting it as successful.

Commit:

```bash
git add src/ui/ReviewQueueView.tsx src/ui/VaultStewardWorkspace.tsx src/main.ts tests/ui/persisted-review-queue.test.tsx tests/e2e/persisted-review-workspace.test.tsx docs/accessibility-review.md
git commit -m "feat: render persisted review findings"
```

## Task 5: Connect Deterministic Reference Repair to Explicit Review Actions

**Files:**

- Modify: `src/review/propose.ts`, `src/review/workflow.ts`, `src/ui/DiffPreview.tsx`, `src/ui/VaultStewardWorkspace.tsx`, `src/main.ts`, `docs/interfaces.md`, `docs/runbooks.md`
- Create: `src/ui/ProposalReviewPanel.tsx`, `tests/ui/proposal-review-panel.test.tsx`, `tests/e2e/persisted-review-workspace.test.tsx`

**Interfaces:**

- Produces `ProposalReviewPanel({ proposal, sources, onAction, onApply })`.
- `onAction` accepts only `"approved" | "dismissed" | "deferred"`; `onApply` accepts only an approved proposal ID.
- Apply callbacks return `{ ok: true } | { ok: false; reason: "stale" | "write-failed" | "canceled" }` and schedule re-index only on `{ ok: true }`.

- [ ] **Step 1: Write failing explicit-review UI tests**

```tsx
fireEvent.click(screen.getByRole("button", { name: "Approve proposal" }));
expect(onAction).toHaveBeenCalledWith("proposal-1", "approved");
fireEvent.click(screen.getByRole("button", { name: "Apply approved change" }));
expect(screen.getByRole("dialog")).toHaveTextContent("Apply this approved change?");
```

- [ ] **Step 2: Run focused UI and workflow tests**

Run: `npx vitest run tests/ui/proposal-review-panel.test.tsx tests/integration/review-workflow.test.ts tests/e2e/persisted-review-workspace.test.tsx`

Expected: FAIL because no proposal action panel exists in the live workspace.

- [ ] **Step 3: Implement proposal rendering and confirmation**

Render the existing deterministic proposal only when `proposeFix` returns `applicable`. The confirmation dialog must name the number of affected notes, present the diff, offer Cancel as the non-destructive default, and never call apply before confirmation.

- [ ] **Step 4: Bind actions to the existing revision-safe workflow**

Record approval/dismiss/defer actions through `ReviewWorkflow.act`. Use the narrow Obsidian vault adapter for apply. Re-render stale and recovery-required results, and invoke re-index only after `ReviewWorkflow.apply` reports success.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit && npm run test:integration && npm run test:e2e && npm run security:check`

Expected: PASS; no UI path permits an unapproved or stale write, and successful apply produces an audit record and re-index event.

Commit:

```bash
git add src/review/propose.ts src/review/workflow.ts src/ui/DiffPreview.tsx src/ui/ProposalReviewPanel.tsx src/ui/VaultStewardWorkspace.tsx src/main.ts tests/ui/proposal-review-panel.test.tsx tests/e2e/persisted-review-workspace.test.tsx docs/interfaces.md docs/runbooks.md
git commit -m "feat: add approved reference repair workflow"
```

## Task 6: Add Live-Model Opt-In Evaluation and Phase Gate

**Files:**

- Modify: `package.json`, `scripts/run-evals.ts`, `docs/evaluation-plan.md`, `docs/testing-strategy.md`, `docs/progress.md`, `task.md`
- Create: `scripts/run-live-model-evals.ts`, `tests/evals/live-model-contract.test.ts`, `evals/datasets/live-model-synthetic.jsonl`, `evals/baselines/live-model.json`

**Interfaces:**

- Produces `npm run eval:local-model`, which reads only synthetic fixtures and exits with a clear unavailable result when the configured loopback provider or selected model is absent.
- Reports provider/model, schema validity, citation validity, latency, retries, incomplete rate, and aggregate thresholds without retaining prompt or fixture excerpts.

- [ ] **Step 1: Write a failing opt-in evaluation contract test**

```ts
await expect(runLiveModelEvaluation({ provider: unavailableProvider })).resolves.toMatchObject({
  available: false,
  passed: false
});
await expect(runLiveModelEvaluation({ provider: fixtureProvider })).resolves.toMatchObject({
  schemaValidity: 1,
  citationValidity: 1
});
```

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/evals/live-model-contract.test.ts`

Expected: FAIL because the opt-in live-model evaluator does not exist.

- [ ] **Step 3: Implement a synthetic-only evaluator and baseline gate**

Use the existing local-provider abstraction, cap calls to one per synthetic case, reject uncited outputs before scoring, and keep this command out of the default hermetic unit suite.

- [ ] **Step 4: Run the real local model after fixture validation**

Run: `OLLAMA_MODEL=llama3.1:8b npm run eval:local-model`

Expected: PASS only when schema and citation validity are 1.0 and all configured latency/incomplete thresholds hold; otherwise fail with a redacted report.

- [ ] **Step 5: Run the Phase 7 completion gate, update docs/tracker, and commit**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test:plugin-install && npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:acceptance && npm run eval:smoke && npm run eval:full && npm run eval:local-model && npm run perf:smoke && npm run ops:smoke && npm run security:check`

Expected: PASS with no unresolved critical safety or migration finding.

Commit:

```bash
git add package.json scripts/run-evals.ts scripts/run-live-model-evals.ts tests/evals/live-model-contract.test.ts evals/datasets/live-model-synthetic.jsonl evals/baselines/live-model.json docs/evaluation-plan.md docs/testing-strategy.md docs/progress.md
git commit -m "test: add live local model release gate"
```

## Plan Self-Review

- **Spec coverage:** Phase 7 maps every current MVP issue family to the review queue, keeps human approval and revision checks authoritative, retains local-only model operation, and adds the missing persisted/workspace connections identified in the release review.
- **Placeholder scan:** The plan contains no deferred implementation markers; every task lists files, interfaces, a failing test, a focused command, an implementation direction, a verification command, and a commit boundary.
- **Type consistency:** `Finding`, `NormalizedFindingInput`, `GovernedScanResult`, `FindingQuery`, `ReviewWorkspaceState`, and proposal action names are introduced before later tasks consume them. Implementation must update exact names consistently if a contract review changes them.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-14-unified-findings-review-workspace.md`.

1. **Subagent-Driven (recommended):** Dispatch a fresh subagent per task and review each change before continuing.
2. **Inline Execution:** Execute tasks in this session with checkpoints after each commit.
