# Simple AI-Guided Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unapproved Phase 19 dashboard with a result-first,
AI-guided scan, repair preview, explicit batch apply, and outcome workflow.

**Architecture:** AI may rank bounded candidate targets or abstain.
Deterministic contracts create proposals, calculate expected outcomes, record
approval, preflight all selected proposals, apply grouped writes, and report
actual results. The React workspace renders one dominant action per state and
moves operational tools outside the default path.

**Tech Stack:** TypeScript, React, Obsidian Plugin API, SQLite/sql.js, Vitest,
Testing Library, existing model-provider abstraction.

## Global Constraints

- Continue on `feat/phase-19-focused-review-workbench`; do not promote the
  existing workbench as-is.
- Update authoritative documents before product code and reconcile ignored
  `task.md` after those document updates.
- Ollama remains local-first; OpenAI remains opt-in with acknowledgement and
  `store: false`.
- Models never construct patches, approve proposals, authorize writes, or
  bypass evidence validation.
- A batch preflight failure writes nothing. Runtime failures retain existing
  rollback and recovery-required behavior.
- `Apply N fixes` is the explicit approval event; no automatic writes.
- Add no runtime dependency and no repair family beyond broken references.

---

### Task 1: Update Product and Architecture Authority

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`, `docs/interfaces.md`, `docs/ai-system.md`
- Modify: `docs/security.md`, `PRIVACY.md`, `SECURITY.md`
- Modify: `docs/testing-strategy.md`, `docs/known-limitations.md`
- Modify: `docs/manual-acceptance-suite.md`, `docs/manual-acceptance-checklist.md`
- Modify: `docs/progress.md`, `CHANGELOG.md`, `ROADMAP.md`
- Test: `tests/docs/public-documentation.test.ts`

**Interfaces:**

- Consumes: the approved design in
  `docs/superpowers/specs/2026-07-28-simple-ai-guided-review-design.md`.
- Produces: one consistent result-first product contract for all later tasks.

- [ ] Add documentation assertions that require the check-preview-apply-result
      workflow, explicit approval, expected-versus-actual result language, and
      advanced-tool separation.
- [ ] Run the documentation test and verify it fails on the old dashboard
      language.
- [ ] Update every listed document without claiming batch code already ships;
      use planned/current-status wording where appropriate.
- [ ] Run `npx vitest run tests/docs/public-documentation.test.ts` and
      `npm run format:check`.
- [ ] Commit with `docs: define simple AI-guided review`.

### Task 2: Reconcile Task Authority and Add Batch Contracts

**Files:**

- Modify: ignored `task.md`
- Create: `src/contracts/prepared-repair.ts`
- Modify: `src/contracts/index.ts`
- Create: `tests/contracts/prepared-repair.test.ts`

**Interfaces:**

- Produces:

```ts
export type PreparedRepairOutcome = {
  expectedFindingsResolved: number;
  notesEdited: number;
  notesCreated: 0;
  notesDeleted: 0;
  findingsLeftUnchanged: number;
};

export type PreparedRepairBatch = {
  schemaVersion: 1;
  id: string;
  scanId: string;
  proposalIds: string[];
  findingIds: string[];
  outcome: PreparedRepairOutcome;
};

export function parsePreparedRepairBatch(value: unknown): PreparedRepairBatchParseResult;
export function calculatePreparedRepairOutcome(
  proposals: readonly Proposal[],
  activeFindingCount: number
): PreparedRepairOutcome;
```

- [ ] Replace Phase 19 tracker items with the seven approved result-first tasks;
      preserve Phase 21 unchanged.
- [ ] Write failing tests for unknown fields, empty/mismatched/duplicate IDs,
      more than 20 items, invalid counts, cross-scan proposals, unique-note counts,
      and zero create/delete output.
- [ ] Run `npx vitest run tests/contracts/prepared-repair.test.ts` and verify
      failure.
- [ ] Implement the minimal parser and pure outcome calculator. Do not persist
      proposal bodies or note excerpts in the batch.
- [ ] Run the focused tests and `npm run typecheck`.
- [ ] Commit with `feat: add prepared repair batch contracts`.

### Task 3: Add Bounded Reference Recommendations

**Files:**

- Create: `src/review/reference-recommendation.ts`
- Modify: `src/model-provider/structured.ts` only if the existing parser cannot
  validate the new typed response.
- Create: `tests/review/reference-recommendation.test.ts`

**Interfaces:**

- Produces:

```ts
export type ReferenceTargetCandidate = {
  id: string;
  path: string;
  source: "rename" | "alias" | "path";
};

export type ReferenceRepairRecommendation =
  | { status: "verified-rename"; findingId: string; targetPath: string }
  | { status: "ai-suggested"; findingId: string; targetPath: string }
  | { status: "abstained"; findingId: string; reason: string };

export async function recommendReferenceRepair(input: {
  finding: Finding;
  scanId: string;
  candidates: readonly ReferenceTargetCandidate[];
  selectCandidate: (request: AgentRequest) => Promise<unknown>;
}): Promise<ReferenceRepairRecommendation>;
```

- [ ] Write failing tests for exact rename, bounded candidate selection,
      abstention, unknown candidate ID, cross-scan finding, missing evidence,
      malformed output, duplicate candidates, prompt injection text, and provider
      failure.
- [ ] Run the focused tests and verify failure.
- [ ] Implement deterministic candidate validation; bypass the model for one
      exact rename candidate; otherwise accept only a returned candidate ID or
      abstention.
- [ ] Prove in tests that model output never supplies replacement text, ranges,
      operations, or approval.
- [ ] Run focused tests, model-provider tests, security tests, and typecheck.
- [ ] Commit with `feat: add bounded reference repair recommendations`.

### Task 4: Add Atomic Batch Approval and Apply

**Files:**

- Modify: `src/review/workflow.ts`
- Modify: `src/main.ts`
- Modify: `src/storage/repositories.ts` only where batch approval lookup needs
  an existing repository query.
- Create: `tests/integration/review-batch-workflow.test.ts`
- Modify: `tests/e2e/review-apply.test.ts`

**Interfaces:**

- Produces:

```ts
export type BatchApplyResult =
  | { ok: true; appliedProposalIds: string[]; notesEdited: number; reindexed: boolean }
  | { ok: false; reason: "stale" | "invalid" | "write-failed" | "recovery-required" };

ReviewWorkflow.approveAndApplyBatch(
  proposals: readonly Proposal[],
  actedAt: string,
  options?: ApplyOptions
): Promise<BatchApplyResult>;
```

- [ ] Write failing tests for one-click individual approval records, complete
      preflight before writes, stale member abort, digest mismatch, duplicate IDs,
      cross-scan batch, cross-proposal overlap, grouped same-note operations,
      rollback, recovery-required state, and re-index reporting.
- [ ] Run the focused integration tests and verify failure.
- [ ] Extract the existing grouped-write logic so single and batch apply share
      validation, ordering, rollback, and status transitions.
- [ ] Implement `approveAndApplyBatch`: validate all proposals and digests,
      record approval for selected proposals, preflight every source, then write.
- [ ] Wire a plugin method that loads proposal IDs from a validated batch and
      returns only the bounded result contract.
- [ ] Run focused integration/E2E tests, security tests, and typecheck.
- [ ] Commit with `feat: add approved repair batch apply`.

### Task 5: Replace the Default Workspace

**Files:**

- Create: `src/ui/PreparedRepairReview.tsx`
- Create: `src/ui/RecommendedAction.tsx`
- Create: `src/ui/ApplyResult.tsx`
- Modify: `src/ui/VaultStewardWorkspace.tsx`, `src/ui/MoreTools.tsx`
- Modify: `styles.css`
- Modify: `tests/ui/workspace.test.tsx`
- Create: `tests/ui/prepared-repair-review.test.tsx`

**Interfaces:**

- Consumes: `PreparedRepairBatch`, proposal/finding joins, and
  `BatchApplyResult`.
- Produces one UI state: `ready | scanning | recommendation | applying |
result | error`.

- [ ] Write failing UI tests for one dominant action, current/after values,
      expected outcome, verified versus AI-suggested label, selected items,
      disabled duplicate apply, actual result, next issue, judgment actions,
      provider recovery, and absence of dashboard counters/filters/confidence.
- [ ] Run the focused UI tests and verify failure.
- [ ] Implement the three focused components and replace the sequential
      dashboard composition with the approved state flow.
- [ ] Keep `View all issues` secondary and move policy, maintenance, history,
      readiness, and observability into one closed Advanced surface.
- [ ] Add pane-container responsive styles, visible focus, theme-safe semantic
      colors, wrapping result previews, and stable control dimensions.
- [ ] Run focused UI tests, accessibility tests, style contract tests, and
      typecheck.
- [ ] Commit with `feat: add simple AI-guided review`.

### Task 6: Complete Plugin Wiring and Release Gate

**Files:**

- Modify: `src/main.ts`
- Modify: `tests/plugin/commands.test.ts`, `tests/e2e/review-apply.test.ts`
- Modify: manual acceptance and progress documentation only for observed final
  behavior.

**Interfaces:**

- Connects scan findings, bounded target candidates, deterministic proposal
  construction, persisted proposals, prepared batches, batch apply, and UI
  results without adding an agent-callable write capability.

- [ ] Add failing plugin/E2E tests for scan-to-prepared-preview, one-click
      approval/apply/re-index, non-repairable recommended action, persisted reload,
      stale recovery, Ollama failure/recovery, and OpenAI acknowledgement.
- [ ] Implement the minimal plugin orchestration and command wiring.
- [ ] Run focused tests, then the full completion gate:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
npm run eval:smoke
npm run eval:full
npm run security:check
npm run package:plugin
npm run test:plugin-install
```

- [ ] Package the Phase 19 build and update final documentation with only
      verified behavior and known limitations.
- [ ] Commit with `test: complete simple AI-guided review gate`.
- [ ] Generate `/tmp/2026-07-28-explanation-simple-ai-guided-review.html`
      through the repository `explain-diff-html` skill.
- [ ] Leave Phase 19 manual acceptance tasks unticked until the user validates
      the packaged build in Obsidian.
