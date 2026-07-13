---
name: vault-steward-typescript
description: Use when changing Vault Steward TypeScript, React, Obsidian plugin, parser, storage, policy, review, or apply modules.
---

# Vault Steward TypeScript

## When to use this skill

Use for TypeScript implementation work in the plugin, deterministic core, storage, parser, policy, or review workflow.

## When not to use this skill

Do not load for model-quality evaluation-only work or documentation-only tasks with no TypeScript contract change.

## Required context

Read `AGENTS.md`, the assigned plan, and the documents named for the task in `docs/context-map.md`.

## Files and directories covered

Planned `src/`, `tests/`, and plugin configuration files.

## Authoritative project documents

`spec.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/interfaces.md`, `docs/security.md`, and `docs/testing-strategy.md`.

## Project conventions

- Keep Obsidian API calls inside `vault-adapter` and UI modules.
- Use explicit TypeScript contracts and runtime validation at I/O, database, YAML, and model boundaries.
- Keep deterministic parsing, policy, validation, evidence resolution, and patch application free of model dependencies.
- SQLite is canonical; optional retrieval stores are derived only.
- Apply mutations only from approved, revision-checked proposals.

## Recommended workflow

1. Find the existing contract, module, and focused fixture before editing.
2. Write a focused failing deterministic test.
3. Implement the smallest contract-preserving change.
4. Run the task's planned checks and update authoritative docs when a contract changes.

## Best practices

- Use narrow adapters and dependency injection for vault, database, time, and model-provider boundaries.
- Return typed error results at recoverable boundaries and include correlation IDs in diagnostics.
- Use synthetic vault fixtures and stable source locators.

## Common mistakes

- Importing Obsidian APIs into graph/policy code.
- Trusting model output or YAML without validation.
- Writing a file without explicit approval and revision recheck.
- Logging note content, prompts, secrets, or absolute paths.

## Required tests and checks

Run the smallest affected planned unit/contract/integration test, then `npm run typecheck`, `npm run lint`, and relevant build checks after tooling exists.

## Completion criteria

The change has focused tests, preserves contract and security boundaries, documents material contract changes, and passes its planned verification.
