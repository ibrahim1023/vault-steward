# Incremental Indexing and Vault History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded, correctness-first incremental scanning, rename/delete impact analysis, and locally persisted scan/finding history.

**Architecture:** Normalize Obsidian events into a scan plan before any vault or model work occurs. SQLite stores per-note parse metadata and finding lifecycle records; an incremental planner reuses unchanged products and falls back to a full scan whenever an event sequence cannot prove safety. Impact analysis uses the persisted graph/reference projection and produces only deterministic, unambiguous repair proposals.

**Tech Stack:** TypeScript, React, Obsidian Plugin API, sql.js, Vitest, existing local-only model/provider contracts.

## Global Constraints

- Work on `feat/phase-8-incremental-indexing` from `development`; promote only after the Phase 8 completion gate passes.
- No Obsidian API imports outside plugin and vault-adapter modules.
- SQLite remains canonical; raw note body content is not retained for history.
- The planner must fall back to `full` for invalid, ambiguous, deleted-with-unknown-impact, or overflowed event batches.
- Incremental scans keep the required local-model stage; unchanged evidence may be reused only when scan input and parser version match.
- Add deterministic tests first, update `task.md`, relevant contracts/docs, and commit each completed task.

---

## File Structure

- `src/contracts/incremental.ts`: versioned file-event and scan-plan contracts.
- `src/indexing/plan.ts`: event normalization, burst deduplication, safety fallback, and affected-path computation.
- `src/indexing/impact.ts`: inbound-link and graph impact analysis plus deterministic rename proposals.
- `src/storage/repositories.ts`, `src/storage/migrations.ts`: per-note parse cache and finding lifecycle queries.
- `src/plugin/main.ts`, `src/main.ts`: queue events, choose incremental/full scans, publish history.
- `src/ui/HistoryView.tsx`: scan and finding lifecycle history without note bodies.
- `tests/indexing/*.test.ts`, `tests/integration/incremental-indexing.test.ts`, `tests/ui/history-view.test.tsx`: contract, persistence, and accessible UI coverage.

## Task 1: Versioned Incremental Scan Planner

**Files:** Create `src/contracts/incremental.ts`, `src/indexing/plan.ts`, `tests/indexing/plan.test.ts`; modify `docs/interfaces.md`, `docs/architecture.md`.

**Interfaces:** `planIncrementalScan(events: readonly VaultEvent[], options: ScanPlanOptions): ScanPlan`, where `ScanPlan` is `{ mode: "incremental"; paths: string[]; reasons: string[] } | { mode: "full"; reasons: string[] }`.

- [x] **Step 1: Write failing planner tests**
  ```ts
  expect(planIncrementalScan([{ kind: "modify", path: "A.md" }], { maxEvents: 50 })).toEqual({
    mode: "incremental",
    paths: ["A.md"],
    reasons: ["modified"]
  });
  expect(planIncrementalScan([{ kind: "rename", path: "A.md" }], { maxEvents: 50 })).toMatchObject({
    mode: "full"
  });
  ```
- [x] **Step 2: Run `npx vitest run tests/indexing/plan.test.ts` and confirm it fails.**
- [x] **Step 3: Implement path validation, last-event-wins deduplication, queue cap, and full fallback.**
  ```ts
  export function planIncrementalScan(
    events: readonly VaultEvent[],
    options: ScanPlanOptions
  ): ScanPlan {
    if (events.length === 0 || events.length > options.maxEvents)
      return { mode: "full", reasons: ["event-overflow"] };
    // reject unsafe/ambiguous events before returning sorted vault-relative paths
  }
  ```
- [x] **Step 4: Run focused tests, `npm run typecheck`, and `npm run format:check`.**
- [x] **Step 5: Commit `feat: add incremental scan planner`.**

## Task 2: Persist Parse Products and Reuse Decisions

**Files:** Modify `src/storage/migrations.ts`, `src/storage/repositories.ts`, `src/core/governed-scan.ts`; create `tests/integration/incremental-indexing.test.ts`.

**Interfaces:** `getReusableParseProducts(input: { vaultFingerprint: string; parserVersion: string; paths: string[] }): ReusableParseProduct[]` and `saveParseProducts(scanId, products): void`.

- [x] **Step 1: Write a failing fixture test proving unchanged revisions are reused and changed revisions are reparsed.**
- [x] **Step 2: Run `npx vitest run tests/integration/incremental-indexing.test.ts` and confirm failure.**
- [x] **Step 3: Add a forward-only migration for parse product metadata only: path, revision hash, parser version, frontmatter/body metadata hashes, and dependencies.**
- [x] **Step 4: Wire the governed scan to reuse only matching parser-version/revision products; require a full parse when dependency correctness is unknown.**
- [x] **Step 5: Run integration/unit/type checks and commit `feat: persist incremental parse products`.**

## Task 3: Rename/Delete Impact Analysis and Repairs

**Files:** Create `src/indexing/impact.ts`, `tests/indexing/impact.test.ts`; modify `src/review/propose.ts`, `docs/interfaces.md`.

**Interfaces:** `analyzeChangeImpact(change: VaultChange, snapshot: ScanSnapshot): ChangeImpact` returns inbound references, embeds, task/decision/policy dependents, and safe proposals. `proposeRenameRepair` returns a proposal only for an exact target match.

- [ ] **Step 1: Write failing tests for inbound links, embeds, deletion impact, and an ambiguous alias with no proposal.**
- [ ] **Step 2: Run `npx vitest run tests/indexing/impact.test.ts` and confirm failure.**
- [ ] **Step 3: Build deterministic dependency traversal from scanner references and graph edges; reject non-vault and ambiguous target rewrites.**
- [ ] **Step 4: Verify proposal revisions/ranges remain revision-bound and no impact analysis writes files.**
- [ ] **Step 5: Run focused tests, integration workflow tests, and commit `feat: analyze vault change impact`.**

## Task 4: Scan and Finding Lifecycle History

**Files:** Modify `src/storage/repositories.ts`, `src/plugin/database.ts`, `src/ui/VaultStewardWorkspace.tsx`; create `src/ui/HistoryView.tsx`, `tests/ui/history-view.test.tsx`.

**Interfaces:** `listScanHistory(limit: number): ScanHistoryRecord[]` and `listFindingLifecycle(findingKey: string): FindingLifecycleRecord[]`; UI shows first seen, last seen, resolved, stale, recurrence, scan timestamps, and counts only.

- [ ] **Step 1: Write failing repository/UI tests for recurrence and resolved states without evidence excerpts or note bodies.**
- [ ] **Step 2: Run `npx vitest run tests/ui/history-view.test.tsx tests/integration/incremental-indexing.test.ts` and confirm failure.**
- [ ] **Step 3: Add typed query methods and a history view with native semantic lists, labelled controls, status/alert states, and narrow-pane-safe metadata.**
- [ ] **Step 4: Ensure resolved means absent from a later completed scan; never delete audit history.**
- [ ] **Step 5: Run unit/UI/E2E checks and commit `feat: add vault scan history`.**

## Task 5: Phase 8 Reliability and Performance Gate

**Files:** Modify `tests/resilience/failure-injection.test.ts`, `scripts/run-performance.ts`, `scripts/run-operational-baseline.ts`, `docs/reliability.md`, `docs/testing-strategy.md`, `docs/progress.md`, `task.md`.

- [ ] **Step 1: Add failing cancellation, event-overflow, restart, duplicate-event, and large-vault incremental tests.**
- [ ] **Step 2: Run focused resilience/performance tests and confirm failure.**
- [ ] **Step 3: Add queue-depth and incremental-reuse metrics; make regressions fail against versioned baselines.**
- [ ] **Step 4: Run the complete Phase 8 gate: format, lint, typecheck, build, install smoke, unit/integration/E2E/acceptance, eval smoke/full/local-model, perf, ops, and security.**
- [ ] **Step 5: Tick Phase 8 tasks, update progress, commit `test: add incremental indexing release gate`, merge into `development`, and push.**

## Plan Self-Review

- **Spec coverage:** Tasks 1-5 cover bounded event planning, per-note reuse, rename/delete impact, lifecycle history, and reliability/performance gates from Phase 8.
- **Placeholder scan:** Every task names files, contracts, failure-first test steps, verification, and a commit boundary.
- **Type consistency:** `VaultEvent`, `ScanPlan`, parse product records, impact records, and lifecycle records are introduced before later tasks consume them.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-15-incremental-indexing.md`. Phase 8 implementation will proceed inline without using Superpowers implementation skills, per repository guidance.
