# Reviewer-Zero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Vault Steward 0.2.0 without avoidable Community Directory review findings.

**Architecture:** Resolve JSX imports to Preact compatibility aliases so UI components retain their contracts while the production bundle excludes React DOM script-resource code. Replace imperative settings rendering with Obsidian 1.13 declarative definitions, harden the flagged TypeScript sites, and publish future releases through an attesting GitHub workflow.

**Tech Stack:** TypeScript, Preact compatibility, Obsidian 1.13 API, esbuild, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-18-reviewer-zero-design.md`

## Global Constraints

- Set plugin/package version to `0.2.0` and `minAppVersion` to `1.13.0`.
- Keep `manifest.main` and vault enumeration as required platform behavior.
- Never add a script loader, arbitrary endpoint, telemetry, shell execution, or autonomous edit path.
- Release only `main.js`, `manifest.json`, and `styles.css`; attest `main.js` and `styles.css`.

---

### Task 1: Replace the packaged UI renderer

**Files:**
- Modify: `package.json`, `package-lock.json`, `esbuild.config.mjs`
- Modify: `tests/ui/workbench-styles.test.ts`
- Create: `tests/packaging/preact-bundle.test.ts`

- [ ] Write a failing package test that builds the plugin and asserts `main.js` contains no `createElement("script")` or Node filesystem fallback.
- [ ] Add `preact`; replace React runtime packages with Preact-compatible test dependencies; configure esbuild aliases for `react`, `react-dom`, and `react-dom/client`.
- [ ] Run the package test, UI tests, and build; retain only Preact runtime code in the bundled output.
- [ ] Commit with `build: replace react-dom bundle runtime`.

### Task 2: Migrate to declarative settings

**Files:**
- Modify: `src/main.ts`, `manifest.json`, `versions.json`, `package.json`, `package-lock.json`
- Modify: `tests/plugin/main-lifecycle.test.ts`, `tests/plugin/manifest.test.ts`
- Create: `tests/plugin/declarative-settings.test.ts`

- [ ] Write failing tests requiring `getSettingDefinitions()`, absence of `display()`, version `0.2.0`, and minimum app version `1.13.0`.
- [ ] Convert each settings control to a declarative definition whose getter reads current settings and setter uses `saveSettings` or `saveTracePreferences`; preserve conditional cloud-provider controls.
- [ ] Run plugin and UI tests, typecheck, and lint.
- [ ] Commit with `feat: adopt declarative settings`.

### Task 3: Remove source-level reviewer warnings

**Files:**
- Modify: `src/model-provider/local-provider.ts`, `src/ui/VaultStewardWorkspace.tsx`, `src/contracts/prepared-repair.ts`, `src/observability/fingerprint.ts`, `src/review/entity-consolidation.ts`, `src/review/reference-recommendation.ts`, `src/storage/repositories.ts`, `evals/release/contracts.ts`
- Modify: relevant existing unit tests under `tests/` and `evals/`

- [ ] Write or adjust targeted tests for cancellation/deadline behavior, typed JSON recovery, and UI callbacks.
- [ ] Replace raw timer calls with `window` timer calls; remove redundant assertions through type guards and typed transformations; return explicit copied values from parsed storage data; wrap async event callbacks in synchronous `void` callbacks.
- [ ] Run targeted tests, lint, and typecheck.
- [ ] Commit with `fix: clear reviewer source warnings`.

### Task 4: Attested release automation

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `README.md`, `docs/release-readiness.md`, `tests/docs/public-documentation.test.ts`

- [ ] Write failing document/workflow tests requiring the tag-triggered release workflow, three assets, and attestation actions.
- [ ] Implement a workflow that runs checks, packages the plugin, creates a GitHub release, uploads only the three supported artifacts, and attests `main.js` and `styles.css`.
- [ ] Update release documentation to require a pushed version tag and workflow-produced release.
- [ ] Run workflow/document tests and formatting.
- [ ] Commit with `ci: attest plugin release assets`.

### Task 5: Completion and 0.2.0 release

**Files:**
- Modify: `CHANGELOG.md`, `docs/progress.md`

- [ ] Add verified 0.2.0 release notes and update progress.
- [ ] Run format, lint, typecheck, build, unit, integration, e2e, eval smoke, production audit, and package-install smoke.
- [ ] Create and push tag `0.2.0`; confirm the GitHub workflow creates the attested release before reporting Community Directory refresh pending.
- [ ] Commit release documentation only before tagging, with `docs: record 0.2.0 review remediation`.
