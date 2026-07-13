# Progress

## Current Phase

Phase 3 in progress: plugin runtime, persistence, and deterministic governance.

## Completed Work

- Product interpretation, architecture, data model, interface, AI, security, reliability, testing, evaluation, context, and limitation documents created.
- Repository instructions, project skills, ADRs, phased implementation plan, evaluation workspace, and foundation review created.
- Phase 1 TypeScript tooling, CI, commands, public contracts, and guidance checks implemented.
- Phase 2 read-only vault scanner, reference-integrity checker, review UI, fixtures, deterministic evaluation, and end-to-end test implemented.
- Phase 3.1 Obsidian manifest, lifecycle entry point, settings validation, status view, command registration, and bundle build implemented.
- Phase 3.2 production Obsidian vault reader with normalized paths, SHA-256 revisions, cancellation, and event invalidation implemented.
- Phase 3.3 SQLite compatibility spike completed with the `sql.js` WebAssembly runtime, plugin-local database path, bundled WebAssembly asset, and ADR 0004.
- Phase 3.4 forward-only SQLite migrations and typed canonical repositories implemented, including fresh-install, upgrade, and failed-migration recovery tests.
- Phase 3.5 immutable scan snapshots, per-file revision inputs, lifecycle transitions, restart recovery, and completed-snapshot reuse implemented.
- Phase 3.6 canonical graph projection implemented for note, entity, project, task, decision, and attachment nodes with deterministic relationship edges.
- Phase 3.7 bounded YAML policy parser and versioned policy validation implemented with user-safe diagnostics.
- Phase 3.8 deterministic policy facts and evaluation implemented for project ownership, task due dates, decision rationale, archived-project tasks, and approved status values.
- Phase 3.9 deterministic frontmatter schema validation implemented with template selection and evidence locators.
- Phase 3.10 deterministic task parsing and integrity checks implemented for malformed, orphaned, duplicate, overdue, and abandoned tasks.
- Phase 3.11 decision indexing now preserves source evidence and detects unresolved rationale and supersession cycles.
- Phase 3.12 deterministic coordinator normalizes evidence-valid findings and persists the review queue without model calls.
- Phase 4.1 versioned, revision-bound proposal contracts implemented with fail-closed patch validation.
- Phase 4.2 deterministic, read-only broken-reference proposals implemented; unsupported findings remain non-applicable.
- Phase 4 review queue, diff preview, explicit approval actions, revision-safe apply, recovery-required state, and end-to-end safety tests implemented.
- Phase 5.1 local-only Ollama and llama.cpp provider abstraction implemented with loopback endpoint validation, timeout/cancellation, response limits, and capability selection.
- Phase 5.2 typed structured-output parsing, bounded repair/fallback, and redacted trace metadata implemented.
- Phase 5.3 bounded evidence-context assembly implemented with untrusted-data delimiters, limits, private-entry exclusion, and cache reuse.
- Phase 5 model-assisted agents implemented for entity aliases/duplicates, contradiction candidates, staleness candidates, and ambiguous decision candidates. All outputs are citation-validated against active scan evidence and assigned conservative deterministic handling.
- Deterministic coordinator routing, declared handoffs, per-agent termination, duplicate suppression, and versioned development/CI/held-out/adversarial/human-review datasets implemented.
- Desktop release packaging now produces a validated manifest, SHA-256 release record, and SQL WebAssembly asset. A temporary Obsidian-style install/uninstall smoke harness verifies the complete release layout.
- Governed scans now require a configured loopback-only local model provider and a completed semantic-analysis stage; provider absence and model-output exhaustion fail closed as incomplete scans.

## Current Work

Phase 6.1 packaging and desktop install lifecycle are complete; next work is performance and hardening coverage.

## Important Decisions

- Obsidian plugin with local TypeScript core.
- SQLite is canonical; LanceDB is optional and derived.
- `sql.js` is the initial desktop-compatible SQLite runtime; its WebAssembly asset ships with the plugin bundle.
- Deterministic controls own parsing, policy, validation, approval, and apply.

## Risks

- Obsidian-compatible SQLite packaging and local model capability need early validation.
- Agent quality thresholds are initial calibration targets.

## Verification Status

Formatting, linting, type checking, build, unit, end-to-end, deterministic evaluation, and dependency-audit checks are configured. Git is initialized; future completed tasks must use small coherent commits. Project skills live in `skills/` because this platform blocks writes to `.codex/`.

## Next Recommended Task

Begin MVP hardening, packaging, and release-readiness work after the completed local-agent branch is promoted.
