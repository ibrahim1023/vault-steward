# Vault Steward

Vault Steward is a local-first Obsidian plugin for auditing note vaults for integrity and governance issues. It combines deterministic Markdown analysis, local persistence, policy checks, and evidence-backed findings while preserving the user's control over every change.

## Capabilities

Vault Steward provides:

- Obsidian plugin lifecycle, settings, command registration, a ribbon launcher, and a workspace view.
- An actionable dashboard for the latest completed scan: health counts, severity-led next action, keyboard-accessible priority findings, selected evidence, and collapsed vault history.
- A read-only Obsidian vault adapter with normalized paths, revision hashes, cancellation, and invalidation events.
- Deterministic Markdown reference-integrity checks and safe proposed repairs for broken internal references.
- Local SQLite-compatible persistence through `sql.js`, forward-only migrations, immutable scan snapshots, and a persisted review queue.
- Revision-bound parse metadata and dependency records for safe in-process parser reuse, with conservative full-scan fallback for ambiguous vault events.
- Rename/delete impact analysis for links, embeds, aliases, task, decision, and policy dependencies, plus a local scan and finding-lifecycle history view that never renders stored evidence content.
- Deterministic graph projection, bounded YAML policy parsing/evaluation, schema validation, task integrity checks, decision validation, and a persisted review queue.
- Required local Ollama or llama.cpp-compatible model provider for bounded entity, contradiction, staleness, and ambiguous-decision analysis. Every candidate is JSON-validated, citation-checked against the active scan, and cannot mutate vault state.
- A fixed-path local Policy Studio with deterministic draft validation and preview, evidence-bounded selected-finding explanations, local model readiness checks, and metadata-only reviewer feedback.

The repository README is kept current as product capabilities change. Architecture decisions, interfaces, operational constraints, and detailed engineering progress are maintained in `docs/`.

## Privacy And Safety

- Local-only: no telemetry, cloud API, remote storage, or automatic note mutation.
- SQLite is the canonical local store. `sql.js` runs SQLite through a bundled WebAssembly asset.
- The deterministic core owns parsing, policy evaluation, evidence validation, finding normalization, and persistence.
- A loopback-only local model is required for a completed governed scan. Provider absence or model-output exhaustion leaves the scan incomplete; it cannot silently fall back to a deterministic-only completion.
- Any note mutation must be explicitly approved and revalidated against the current source revision.

## Requirements

- Node.js 20 or newer
- Obsidian desktop 1.5.0 or newer
- A running local Ollama service with a configured model, or a compatible local llama.cpp endpoint

## Development

Install dependencies and run the verification suite:

```bash
npm install
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run package:plugin
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:acceptance
npm run eval:smoke
npm run perf:smoke
npm run ops:smoke
npm run security:check
```

`npm run build` writes `main.js` and `sql-wasm.wasm` at the project root. `npm run package:plugin` creates `dist/vault-steward/` with those assets, `styles.css`, `manifest.json`, and a SHA-256 `release-manifest.json`. Install that directory as `vault-steward` under an Obsidian vault's `.obsidian/plugins/` directory.

## Repository Guide

- `src/main.ts`: Obsidian plugin entry point and settings/status UI wiring.
- `src/vault-adapter/`: narrow live-vault boundary.
- `src/scanner/` and `src/reference/`: deterministic Markdown parsing and reference checks.
- `src/storage/`: SQLite runtime, migrations, repositories, and scan snapshots.
- `src/graph/`, `src/policy/`, `src/schema/`, `src/tasks/`, `src/decisions/`, `src/coordinator/`: deterministic governance and finding pipeline.
- `src/model-provider/` and `src/agents/`: loopback-only model adapters, bounded context assembly, typed output validation, and deterministic agent coordination.
- `tests/`: unit, integration, UI, and end-to-end coverage.
- `docs/`: architecture, interfaces, security, reliability, and ADRs.

Read [AGENTS.md](AGENTS.md) before contributing. It defines module boundaries, test expectations, privacy constraints, and the completion gate.

See [upgrade notes](docs/upgrade-notes.md) for install, upgrade, and uninstall guidance.

See [local runbooks](docs/runbooks.md) for recovery procedures and diagnostic handling.

## Commands

| Command                       | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `npm run format:check`        | Check Prettier formatting.                                         |
| `npm run lint`                | Run ESLint.                                                        |
| `npm run typecheck`           | Run strict TypeScript checking.                                    |
| `npm run build`               | Build the Obsidian plugin bundle and SQLite WebAssembly asset.     |
| `npm run package:plugin`      | Produce a versioned desktop-plugin release directory.              |
| `npm run test:plugin-install` | Run the packaged install/uninstall smoke harness.                  |
| `npm run test:unit`           | Run deterministic unit and component tests.                        |
| `npm run test:integration`    | Run SQLite migration, snapshot, and coordinator integration tests. |
| `npm run test:e2e`            | Run the current end-to-end reference-finding test.                 |
| `npm run test:acceptance`     | Run the synthetic MVP vault acceptance suite.                      |
| `npm run eval:smoke`          | Run the deterministic reference-integrity evaluation.              |
| `npm run eval:full`           | Run all registered evaluations.                                    |
| `npm run perf:smoke`          | Run the fixed large-vault and incremental-scan performance gate.   |
| `npm run ops:smoke`           | Run metadata-only MVP operational baseline checks.                 |
| `npm run security:check`      | Audit production dependencies.                                     |
