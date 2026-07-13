# Vault Steward

Vault Steward is a local-first Obsidian plugin for auditing note vaults for integrity and governance issues. It combines deterministic Markdown analysis, local persistence, policy checks, and evidence-backed findings while preserving the user's control over every change.

## Capabilities

Vault Steward provides:

- Obsidian plugin lifecycle, settings, command registration, and a status view.
- A read-only Obsidian vault adapter with normalized paths, revision hashes, cancellation, and invalidation events.
- Deterministic Markdown reference-integrity checks and safe proposed repairs for broken internal references.
- Local SQLite-compatible persistence through `sql.js`, forward-only migrations, immutable scan snapshots, and a persisted review queue.
- Deterministic graph projection, bounded YAML policy parsing/evaluation, schema validation, task integrity checks, decision validation, and a persisted review queue.
- Optional local Ollama or llama.cpp-compatible model providers for bounded entity, contradiction, staleness, and ambiguous-decision candidates. Every candidate is JSON-validated, citation-checked against the active scan, and cannot mutate vault state.

The repository README is kept current as product capabilities change. Architecture decisions, interfaces, operational constraints, and detailed engineering progress are maintained in `docs/`.

## Privacy And Safety

- Local-only: no telemetry, cloud API, remote storage, or automatic note mutation.
- SQLite is the canonical local store. `sql.js` runs SQLite through a bundled WebAssembly asset.
- The deterministic core owns parsing, policy evaluation, evidence validation, finding normalization, and persistence.
- Local models are optional, loopback-only, and cannot authorize edits.
- Any note mutation must be explicitly approved and revalidated against the current source revision.

## Requirements

- Node.js 20 or newer
- Obsidian desktop 1.5.0 or newer

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
npm run eval:smoke
npm run security:check
```

`npm run build` writes `main.js` and `sql-wasm.wasm` at the project root. `npm run package:plugin` creates `dist/vault-steward/` with those assets, `manifest.json`, and a SHA-256 `release-manifest.json`. Install that directory as `vault-steward` under an Obsidian vault's `.obsidian/plugins/` directory.

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
| `npm run eval:smoke`          | Run the deterministic reference-integrity evaluation.              |
| `npm run eval:full`           | Run all registered evaluations.                                    |
| `npm run security:check`      | Audit production dependencies.                                     |
