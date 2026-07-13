# Vault Steward Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a testable local Obsidian plugin foundation and deliver the first read-only reference-integrity vertical slice.

**Architecture:** Implement a deterministic TypeScript core behind a narrow Obsidian vault adapter, SQLite repository interfaces, typed contracts, and a React review UI. Local models remain behind a bounded provider interface and are not required for the first vertical slice.

**Tech Stack:** TypeScript, Obsidian Plugin API, React, unified/remark/mdast/gray-matter, SQLite adapter to be validated, Vitest, Playwright or an Obsidian-compatible UI harness, and a runtime schema validator.

## Global Constraints

- Offline only; no telemetry, cloud API, remote storage, shell tools, or autonomous edits.
- SQLite is canonical; semantic retrieval is optional and derived.
- Deterministic code owns parsing, policy, validation, evidence, approval, and apply.
- Every note mutation requires explicit approval and source-revision validation.
- Planned commands become real only when Task 3 introduces their scripts.

---

## Task 1: Foundation Documentation and Contracts

### Objective

Create an importable contract index and source layout without product behavior.

### Required context

`AGENTS.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/interfaces.md`, and `docs/security.md`.

### Required skills

`superpowers:writing-plans`, `vault-steward-typescript`.

### Files to create or modify

- Create: `src/contracts/index.ts`, `src/core/README.md`, `tests/contracts/contracts.test.ts`
- Modify: `AGENTS.md`, `docs/progress.md`

### Implementation steps

- [ ] Define TypeScript exports for `Finding`, `AgentRequest`, `AgentCandidate`, `ToolResult`, and `VaultStewardError` as specified in `docs/interfaces.md`.
- [ ] Write a compile-only test importing each export and constructing a representative `Finding` value.
- [ ] Run the test to confirm it fails before the contract module exists.
- [ ] Add the minimal exports and run the focused test again.
- [ ] Add a core README that forbids direct Obsidian imports outside adapters/UI.

### Constraints

No scanning, storage, model, or UI behavior.

### Out of scope

Parser implementation, database access, provider integration, and settings.

### Tests

The compile-only contract test must import every public boundary type.

### Evaluations

None; the work is deterministic.

### Verification commands

Planned after Task 3: `npm run typecheck` and `npm run test:unit`.

### Acceptance criteria

All cross-boundary shapes are explicit and match `docs/interfaces.md`.

### Documentation updates

Update progress and interface docs when a justified discrepancy is found.

## Task 2: Repository Instructions and Project Skills

### Objective

Validate that instructions and skills route work to minimal, relevant context.

### Required context

`AGENTS.md`, `docs/context-map.md`, `docs/skills-inventory.md`, and `skills/*/SKILL.md`.

### Required skills

`superpowers:writing-skills`, `superpowers:verification-before-completion`.

### Files to create or modify

- Create: `tests/docs/agent-guidance.test.ts`, `tests/docs/skill-pressure-scenarios.md`
- Modify: `AGENTS.md`, `docs/context-map.md`, `docs/skills-inventory.md`, `skills/*/SKILL.md`

### Implementation steps

- [ ] Add a structural test requiring all mandated project-skill sections and “Use when” frontmatter.
- [ ] Add a test that rejects unlabeled commands in `AGENTS.md` until `package.json` implements them.
- [ ] Record baseline and post-guidance pressure scenarios for each project skill before revising its wording.
- [ ] Run the checks and change only the instruction content that fails.

### Constraints

Do not restate architecture in skills or `AGENTS.md`.

### Out of scope

Product logic and CI execution.

### Tests

Guidance structure checks and pressure-scenario records for each project skill.

### Evaluations

None; this validates operational guidance.

### Verification commands

Planned after Task 3: `npm run test:unit`.

### Acceptance criteria

Skills have non-overlapping triggers and every advertised command is real or clearly planned.

### Documentation updates

Update the inventory and progress after guidance changes.

## Task 3: Tooling and CI Baseline

### Objective

Introduce the smallest TypeScript toolchain that makes every planned command real.

### Required context

`AGENTS.md`, `docs/testing-strategy.md`, `docs/security.md`, and Task 1 contracts.

### Required skills

`superpowers:test-driven-development`, `vault-steward-typescript`, `vault-steward-testing-evals`.

### Files to create or modify

- Create: `package.json`, `tsconfig.json`, format/lint configuration, `.github/workflows/verify.yml`
- Modify: `AGENTS.md`, `docs/testing-strategy.md`, `docs/progress.md`

### Implementation steps

- [ ] Add a failing smoke test that imports the contract module through the chosen runner.
- [ ] Configure strict TypeScript, formatting, linting, unit tests, build, and dependency audit.
- [ ] Implement scripts named `format:check`, `lint`, `typecheck`, `build`, `test:unit`, `test:integration`, `test:e2e`, `eval:smoke`, `eval:full`, and `security:check`.
- [ ] Make empty future test/eval categories report an explicit registered-suite state with exit zero.
- [ ] Add CI stages in the order prescribed by `docs/testing-strategy.md` and run the local equivalent.

### Constraints

Pin dependency ranges via the lockfile. Do not install cloud or model runtime dependencies.

### Out of scope

Plugin behavior, database, and model calls.

### Tests

The smoke test proves the runner executes TypeScript tests.

### Evaluations

Smoke/full scripts report an empty registered-suite state until Task 5.

### Verification commands

`npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run security:check`.

### Acceptance criteria

All `AGENTS.md` commands exist and CI executes the fast deterministic gates.

### Documentation updates

Remove “planned” only from implemented commands and record selected tool versions.

## Task 4: Read-Only Scanner and Reference Integrity

### Objective

Implement a deterministic broken-reference scanner with evidence-backed findings and no model or write capability.

### Required context

`docs/architecture.md`, `docs/interfaces.md`, `docs/security.md`, `docs/testing-strategy.md`, and `vault-steward-typescript`.

### Required skills

`superpowers:test-driven-development`, `vault-steward-typescript`.

### Files to create or modify

- Create: `src/vault-adapter/types.ts`, `src/scanner/scan.ts`, `src/reference/check.ts`, `tests/fixtures/vaults/references/`, `tests/reference/check.test.ts`
- Modify: `src/contracts/index.ts`, `docs/interfaces.md`, `docs/progress.md`

### Implementation steps

- [ ] Add failing fixtures for valid wiki links, missing notes/attachments, invalid anchors, and escaped paths.
- [ ] Define a read-only `VaultReader` interface with normalized paths and revision hashes.
- [ ] Implement Markdown/link extraction and evidence locators through the selected parser.
- [ ] Implement reference checks returning typed findings only.
- [ ] Run unit/property checks for traversal and unsupported URI rejection.

### Constraints

All paths stay inside the active vault. Scan results are snapshot-bound.

### Out of scope

Entity matching, staleness, models, SQLite persistence, and edits.

### Tests

Unit tests cover each fixture; property tests exercise path normalization; contracts prove `VaultReader` has no write method.

### Evaluations

Add a deterministic reference-integrity dataset graded exactly against fixtures.

### Verification commands

`npm run test:unit`, `npm run test:integration`, `npm run eval:smoke`, `npm run typecheck`.

### Acceptance criteria

A synthetic vault returns evidence-backed broken-reference findings without model calls or mutation.

### Documentation updates

Update interfaces, evaluation inventory, and progress.

## Task 5: Evaluation Infrastructure

### Objective

Create versioned deterministic grading and reporting for reference integrity, generalized only through reusable interfaces.

### Required context

`docs/evaluation-plan.md`, `docs/testing-strategy.md`, `docs/interfaces.md`, and Task 4 outputs.

### Required skills

`vault-steward-testing-evals`, `superpowers:test-driven-development`.

### Files to create or modify

- Create: `evals/datasets/reference-integrity.jsonl`, `evals/graders/reference-integrity.ts`, `evals/scenarios/reference-integrity.ts`, `evals/baselines/reference-integrity.json`, `evals/reports/.gitkeep`
- Modify: `package.json`, `docs/evaluation-plan.md`, `docs/progress.md`

### Implementation steps

- [ ] Add a failing grader test for a missing expected evidence locator.
- [ ] Define a JSONL case schema with ID, fixture, expected keys, split, and contamination status.
- [ ] Implement exact schema/evidence/precision/recall grading with zero token/latency fields for deterministic runs.
- [ ] Add smoke/full runner selection and machine-readable redacted reports.
- [ ] Generate the initial baseline from passing fixtures and record its version.

### Constraints

Reports cannot contain raw note content. Baseline updates require recorded rationale.

### Out of scope

LLM-as-judge, hosted reporting, and provider execution.

### Tests

Test case parsing, grading, baseline comparison, and report redaction.

### Evaluations

Reference-integrity smoke must report evidence validity, precision, and recall of 1.0 on the fixture set.

### Verification commands

`npm run test:unit && npm run eval:smoke && npm run eval:full`.

### Acceptance criteria

The suite, baseline, regression gate, and redacted reports reproduce locally.

### Documentation updates

Update evaluation inventory and progress with baseline versions.

## Task 6: First Review-Only Vertical Slice

### Objective

Expose reference-integrity findings in Obsidian with evidence and no apply action.

### Required context

`docs/architecture.md`, `docs/interfaces.md`, `docs/security.md`, `docs/testing-strategy.md`, and Task 4/5 output.

### Required skills

`superpowers:test-driven-development`, `vault-steward-typescript`, `vault-steward-testing-evals`.

### Files to create or modify

- Create: `src/plugin/main.ts`, `src/ui/ReferenceFindingsView.tsx`, `tests/ui/reference-findings.test.tsx`, `tests/e2e/reference-findings.spec.ts`
- Modify: `docs/progress.md`, `docs/known-limitations.md`

### Implementation steps

- [ ] Add a failing UI test for severity, affected note, and evidence locator in a finding row.
- [ ] Implement a scan command that invokes only the read-only reference checker and stores session findings.
- [ ] Implement list/detail UI states for empty, scanning, error, and findings.
- [ ] Add a negative test proving no write/apply tool is registered.
- [ ] Run UI/e2e checks on the synthetic fixture and run the deterministic eval suite.

### Constraints

No models, policy editor, persistence, approval, diff preview, or mutation.

### Out of scope

All other agents and the full review/apply flow.

### Tests

Component states, scan-to-evidence end-to-end flow, and no-write-tool assertion.

### Evaluations

Run reference-integrity deterministic evaluation.

### Verification commands

`npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run test:e2e && npm run eval:smoke && npm run security:check`.

### Acceptance criteria

Users can start a local read-only scan and inspect evidence-backed broken-reference findings with no mutation path.

### Documentation updates

Update progress, limitations, contracts, and test/eval inventories.

## Future Milestones

- SQLite scan persistence and migrations.
- Schema, task, and policy deterministic agents.
- Approved diff preview and stale-safe apply workflow.
- Local model provider, semantic agents, and calibrated evaluations.
- Optional semantic retrieval only after measured need.
