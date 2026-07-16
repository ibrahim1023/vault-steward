# Policy Studio and Local Intelligence Implementation Plan

> **For agentic workers:** Supporting design only. Implement with the repository's native TypeScript workflow, deterministic tests first, and frequent focused commits.

**Goal:** Deliver all Phase 9 policy-authoring and evidence-bounded local-intelligence capabilities without allowing models or drafts to mutate vault state implicitly.

**Architecture:** Add pure policy-studio, explanation, readiness, feedback, and evaluation modules behind existing contracts. `src/main.ts` remains the Obsidian adapter boundary; React components consume explicit callbacks only. SQLite stores feedback metadata only, while draft policy and raw model explanation output remain transient.

**Tech Stack:** TypeScript, React, Obsidian Plugin API, sql.js, Vitest, YAML parser, existing loopback local-model provider.

## Global Constraints

- Use `.vault-steward/policy.yaml` as the single active policy path; reject traversal and arbitrary paths.
- Validate YAML before preview or explicit save; never save on edit.
- Do not expose vault search, tools, writes, or uncited note content to the explanation request.
- Keep all provider, evaluation, feedback, and storage data local and free of raw note bodies, prompts, raw outputs, absolute paths, and secrets.
- A missing or failed local model is a visible incomplete state, never a deterministic-only governed completion.

---

### Task 1: Policy Studio Contracts and Deterministic Preview

**Files:**
- Create: `src/policy/studio.ts`, `tests/policy/studio.test.ts`
- Modify: `src/policy/parse.ts`, `src/policy/evaluate.ts`

**Interfaces:**
- Produces `POLICY_STUDIO_PATH`, `validatePolicyPath(path)`, `createPolicyDraft(source)`, and `previewPolicyDraft(source, facts)`.
- `previewPolicyDraft` returns either parse diagnostics or `PolicyViolation[]`; it performs no I/O.

Steps: write failing tests for missing/invalid/valid drafts, the fixed path, and preview violations; implement the smallest pure helpers; run `npx vitest run tests/policy`; commit `feat: add policy studio preview`.

### Task 2: Policy File Adapter, Plugin Callbacks, and UI

**Files:**
- Create: `src/ui/PolicyStudio.tsx`, `tests/ui/policy-studio.test.tsx`
- Modify: `src/main.ts`, `src/ui/VaultStewardWorkspace.tsx`, `styles.css`, `tests/ui/workspace.test.tsx`

**Interfaces:**
- Plugin callbacks: `loadPolicyDraft(): Promise<string>`, `previewPolicy(source): Promise<PolicyPreview>`, and `savePolicy(source): Promise<void>`.
- UI receives the callbacks, tracks the in-memory draft, and exposes explicit Preview and Save controls.

Steps: write component tests for validation, save gating, preview, missing snapshot, and reload after save; implement plugin reads/writes through the vault adapter at the fixed path; add the workspace section and narrow-sidebar styling; run UI and targeted plugin tests; commit `feat: add local policy studio`.

### Task 3: Evidence-Bounded Explanation and Model Readiness

**Files:**
- Create: `src/agents/finding-explanation.ts`, `src/model-provider/readiness.ts`, `tests/agents/finding-explanation.test.ts`, `tests/model-provider/readiness.test.ts`, `src/ui/FindingExplanation.tsx`, `tests/ui/finding-explanation.test.tsx`
- Modify: `src/main.ts`, `src/plugin/settings.ts`, `src/ui/FindingDetail.tsx`, `src/ui/VaultStewardWorkspace.tsx`, `tests/plugin/settings.test.ts`

**Interfaces:**
- `buildFindingExplanationRequest(finding)` returns a capped prompt generated from cited evidence only.
- `explainFinding(provider, finding)` returns a redacted result or failure code.
- `checkModelReadiness(provider)` returns provider/model identity, limits, measured latency, structured-output state, and redacted failure code.

Steps: write tests proving unrelated note data cannot enter explanation requests and malformed/failed model output is bounded; add bounded profile settings and readiness tests; implement UI actions with loading, failure, and selection-reset states; run affected suites; commit `feat: add bounded explanations and readiness`.

### Task 4: Feedback Storage and Quality Reports

**Files:**
- Modify: `src/storage/migrations.ts`, `src/storage/repositories.ts`, `src/main.ts`, `src/ui/FindingDetail.tsx`, `src/ui/VaultStewardWorkspace.tsx`
- Create: `src/feedback/review.ts`, `src/feedback/report.ts`, `tests/feedback/review.test.ts`, `tests/feedback/report.test.ts`, `tests/integration/feedback-storage.test.ts`, `tests/ui/finding-feedback.test.tsx`

**Interfaces:**
- `validateReviewerFeedback(input)` accepts a known finding ID, optional proposal ID, verdict, and bounded label.
- Repository methods save and aggregate metadata-only feedback.
- `summarizeReviewerFeedback(records)` returns counts and policy-tuning hints without changing any policy.

Steps: write migration and validation tests first; add a forward-only table and repository methods; add explicit feedback controls to the selected-finding view; run storage/UI/integration suites; commit `feat: add local reviewer feedback`.

### Task 5: Model-Assisted Evaluation Expansion

**Files:**
- Create: `evals/graders/model-quality.ts`, `evals/datasets/model-quality.jsonl`, `tests/evals/model-quality.test.ts`
- Modify: `evals/graders/model-assisted.ts`, `scripts/run-evals.ts`, `docs/evaluation-plan.md`, `README.md`

**Interfaces:**
- `gradeModelQuality(cases, results)` returns precision, recall, F1, false-positive/negative counts, citation and schema validity, severity agreement, unsupported-claim rate, and redacted metadata.
- CLI supports `--suite model-quality` and fails when deterministic citation/schema gates or configured thresholds fail.

Steps: add held-out and human-review metadata fixtures with no note text in outputs; write deterministic grader tests; integrate report writing and threshold checks; document methodology and local-only constraints; run `npm run eval:full`; commit `feat: expand local model evaluations`.

### Task 6: Phase Completion and Promotion

**Files:**
- Modify: `README.md`, `docs/progress.md`, `docs/upgrade-notes.md`, `task.md` (ignored local tracker)

Steps: run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run test:acceptance`, `npm run eval:smoke`, `npm run eval:full`, `npm run test:plugin-install`, and `npm run security:check`; manually exercise policy draft/save/preview, explanation, readiness failure/recovery, and feedback in Obsidian; tick Phase 9 tasks; merge `feat/phase-9-policy-studio` into `development`; push and package.

## Plan Self-Review

- Coverage: Tasks 1-2 implement 9.1; Task 3 implements 9.2-9.3; Task 5 implements 9.4; Task 4 implements 9.5.
- Scope: no profile registry, arbitrary policy paths, remote telemetry, agent tools, automatic policy tuning, or automatic edits are introduced.
- Contracts: every provider use remains behind `LocalProvider`; deterministic modules own validation and evaluation; adapter methods own vault I/O.
