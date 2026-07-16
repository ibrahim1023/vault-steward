# Proactive Maintenance and Release Quality Implementation Plan

> **For agentic workers:** Supporting design only. Implement with repository-native TypeScript patterns, deterministic tests first, and focused commits.

**Goal:** Deliver user-controlled local maintenance scheduling, deterministic maintenance views, redacted configuration portability, and reproducible release safeguards.

**Architecture:** Pure scheduler, maintenance, and portability modules define decisions and serialized contracts. The plugin owns Obsidian timers/files, the React workspace receives callbacks, and SQLite continues to own only canonical local records. Release checks remain deterministic scripts and fixtures.

**Tech Stack:** TypeScript, React, Obsidian Plugin API, sql.js, Vitest, existing package scripts.

## Global Constraints

- Scheduling is disabled by default, is local-only, never overlaps scans, and stops on unload.
- Maintenance ranking consumes the latest completed scan only and performs no writes.
- Export/import excludes note bodies, evidence excerpts, paths, provider endpoints, prompts, raw outputs, database bytes, and secrets.
- Import validates completely and requires explicit user confirmation before any write.
- Compatibility claims must identify automated coverage separately from manual desktop validation.

### Task 1: Local Scheduler

**Files:** Create `src/maintenance/scheduler.ts`, `tests/maintenance/scheduler.test.ts`; modify `src/plugin/settings.ts`, `src/main.ts`, `src/ui/VaultStewardWorkspace.tsx`.

Implement typed schedule settings and pure trigger eligibility for interval/event/debounce/budget/paused/in-flight states. Add plugin timer lifecycle plus visible pause, next-run, and last-run UI. Test disabled default, no overlap, debounce, budgets, pause, unload disposal, and safe failure recovery. Commit `feat: add local maintenance scheduler`.

### Task 2: Maintenance Queue and Impact View

**Files:** Create `src/maintenance/queue.ts`, `src/ui/MaintenanceView.tsx`, `tests/maintenance/queue.test.ts`, `tests/ui/maintenance-view.test.tsx`; modify workspace and plugin callbacks.

Group by type/evidence locators, rank representatives deterministically, and display read-only impact categories from `ChangeImpact`. Test latest-scan isolation, grouping, stable ranking, and no destructive control. Commit `feat: add maintenance workspace`.

### Task 3: Redacted Settings Export/Import

**Files:** Create `src/portability/bundle.ts`, `tests/portability/bundle.test.ts`, `tests/integration/portability.test.ts`; modify plugin/database callbacks and workspace UI.

Define versioned bundle schema, redaction checks, size limits, dry-run diagnostics, confirmation-gated application, fixed policy path writes, and append-only decision import. Test invalid inputs and transaction-like no-partial-mutation behavior. Commit `feat: add redacted settings portability`.

### Task 4: Compatibility and Acceptance Assets

**Files:** Create `src/release/compatibility.ts`, `tests/release/compatibility.test.ts`, `tests/integration/release-rehearsal.test.ts`, `docs/desktop-accessibility-protocol.md`, `docs/acceptance-vault.md`; modify release scripts/README/upgrade notes.

Add package/manifest compatibility assertions, migration plus backup/restore rehearsal, an explicit desktop accessibility protocol, and a reproducible synthetic acceptance vault. Commit `test: add release compatibility rehearsal`.

### Task 5: Release Review and Promotion

**Files:** Modify `docs/release-review.md`, `docs/known-limitations.md`, `docs/progress.md`, `task.md` (ignored local tracker).

Record tested evidence and unresolved manual checks. Run the complete completion gate, package the plugin, tick Phase 10 tasks, merge into `development`, and push the promoted phase.
