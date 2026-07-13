# Vault Steward Agent Guide

Vault Steward is a local-first Obsidian plugin that audits a vault for integrity issues. It parses vault content deterministically, uses local models only for bounded reasoning, and never edits notes without an explicit user approval.

## Read Order

1. `AGENTS.md`
2. The assigned task plan in `docs/superpowers/plans/`
3. Only the relevant documents named in `docs/context-map.md`
4. Relevant source files and tests

Product behavior is authoritative in `spec.md`. Architecture, contracts, and operating constraints live in `docs/architecture.md`, `docs/interfaces.md`, `docs/ai-system.md`, `docs/security.md`, and `docs/testing-strategy.md`. Record material deviations in `docs/progress.md`.

## Architecture Boundaries

- Plugin/UI: Obsidian Plugin API, TypeScript, React.
- Core: parser, graph, policy, findings, review workflow, and storage modules; do not import Obsidian APIs into core modules.
- SQLite owns indexed vault state, scans, findings, approvals, and audit records. LanceDB is optional and never the source of truth.
- Deterministic code parses, validates, enforces policy, builds diffs, and applies approved edits. Models may classify, extract candidates, or rank evidence only through typed contracts.
- All model providers are local and accessed through a provider abstraction. No telemetry, cloud APIs, remote storage, shell execution, or broad filesystem access.

## Working Rules

- Keep changes scoped to the assigned plan task; do not expand product scope silently.
- Prefer existing local patterns and explicit TypeScript types. Keep public contracts in `src/contracts/` when introduced.
- Validate all untrusted input and model output before use. A model result cannot directly mutate vault state, alter policy, or authorize a tool.
- Use structured logging without note content, secrets, prompts, or absolute vault paths unless an approved diagnostic mode explicitly permits it.
- Add or update deterministic tests before behavior changes. Put non-deterministic quality checks in `evals/`, not brittle unit tests.
- Update contracts, ADRs, plans, and `docs/progress.md` when their authority changes.

## Commands

Run the narrowest relevant command first, then the full completion gate for a phase or user-facing change.

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
```

## Completion Gate

Do not claim a task complete until its acceptance criteria were reviewed, relevant tests/evals and static/build checks were run, documentation is current, and no unresolved critical finding remains. State any unavailable verification explicitly.
