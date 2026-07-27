# Vault Steward

Continuous integrity checks for local Obsidian vaults.

Vault Steward audits Markdown knowledge bases for broken references, schema problems, task and decision drift, policy violations, and bounded model candidates. It presents cited findings for review and never edits a note without an explicit, revision-safe approval.

## Who It Is For

Vault Steward is for people and teams who keep durable project knowledge in an Obsidian vault and need to find maintenance problems before they become misleading or expensive. It is not a chat-with-your-vault tool: its primary job is integrity, governance, and evidence-backed review.

## How It Works

```text
Local vault -> deterministic parser and graph -> policy and integrity checks
            -> bounded model candidates -> deterministic validation
            -> review queue -> explicit approved change
```

The deterministic core owns parsing, policies, evidence validation, finding normalization, persistence, diffs, and apply decisions. The selected model may classify, extract candidates, or rank cited evidence through typed contracts. A model result cannot directly modify a vault, choose severity, change policy, approve a proposal, or apply an edit.

## Privacy And Safety

- Runs locally in the Obsidian desktop process with SQLite as the canonical local store.
- Defaults to loopback-configured Ollama or llama.cpp-compatible local model providers for governed scans.
- OpenAI is an optional, explicit setting. It sends bounded selected evidence and prompts to the fixed OpenAI API only after the user enters an API key and acknowledges the cloud-data warning.
- Does not send telemetry, traces, metrics, or model output to a cloud service. OpenAI API keys are excluded from traces, diagnostics, fingerprints, and exports.
- Stores metadata-only traces by default; note bodies, prompts, raw model outputs, absolute paths, URLs, and secrets are excluded.
- Requires explicit approval and a current source-revision check before every note mutation.
- Treats retrieval, replay, model comparisons, calibration, and policy coverage as informational quality signals, never edit authority.

Read the detailed [privacy statement](PRIVACY.md) and [security guidance](SECURITY.md) before evaluating sensitive vaults.

## What It Checks

- Broken internal links, embeds, and anchors, with safe reference-repair previews where a replacement is unambiguous.
- Markdown/frontmatter schema violations, task integrity problems, unresolved decisions, and deterministic YAML policy violations.
- Bounded local-model candidates for duplicate entities, contradictions, staleness, and ambiguous decisions, subject to citation and schema validation.
- Rename/delete impact, scan history, finding lifecycle, trace lineage, and operational metadata.

## Installation

Requirements:

- Node.js 20 or newer for development and packaging.
- Obsidian desktop 1.5.0 or newer.
- Either a running local Ollama service with a configured model, a compatible loopback-only llama.cpp endpoint, or an OpenAI API key and an explicit cloud-data acknowledgement.

For manual installation, build the plugin and copy `dist/vault-steward/` into `<vault>/.obsidian/plugins/vault-steward/`, then enable it in Obsidian's community-plugin settings. The package contains `main.js`, `manifest.json`, `styles.css`, `sql-wasm.wasm`, and a release manifest. See [release compatibility](docs/release-compatibility.md) and [troubleshooting](docs/troubleshooting.md) for upgrade and recovery guidance.

## Model Providers

Vault Steward requires a configured model provider for its governed semantic-analysis stage. Ollama and llama.cpp stay local. The optional OpenAI provider uses the Chat Completions API with JSON mode and `store: false`; it uses the fixed `https://api.openai.com/v1` origin rather than a configurable remote endpoint. Selecting OpenAI requires a model, API key, and explicit acknowledgement that bounded selected vault evidence can leave the device. Run the readiness check in the plugin before a scan.

Model behavior varies by hardware, configuration, vault content, and task. This repository does not claim a universal best model. Record local quality and latency measurements using the evaluation reports described in [local model guidance](docs/local-models.md).

## Evaluation And Observability

Fixture evaluation, replay, generated scale coverage, retrieval-quality measurement, policy coverage, and confidence calibration are local-only tools for assessing behavior:

```bash
npm run eval:smoke
npm run eval:full
npm run eval:synthetic
npm run eval:retrieval
npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json
```

Fixture replay writes a redacted local record to `evals/reports/replay.json`. Controlled comparisons accept the same fixture manifest with exactly one changed configuration value: model, prompt, threshold, retrieval, policy, or agent. Live scans retain metadata rather than historical source by default, so they report replay eligibility instead of reconstructing old notes.

Generated scale evaluation currently measures the deterministic reference family against exact synthetic ground truth. Retrieval metrics, policy coverage, model comparisons, and calibration describe recorded conditions only; they do not select a model or alter product behavior. See [evaluation methodology](EVALS.md) and [observability and retained data](OBSERVABILITY.md).

## Limitations

- Vault Steward cannot establish objective truth or verify external facts without an external source.
- It can miss implicit contradictions and may produce false positives, especially with smaller models or weak note structure.
- Staleness and decision quality are contextual; evidence quality depends on note quality.
- No model output is sufficient on its own to authorize a change.
- Synthetic metrics are engineering signals, not a guarantee of accuracy on a user vault.

## Development

```bash
npm install
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:plugin-install
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:acceptance
npm run eval:smoke
npm run eval:full
npm run eval:synthetic
npm run eval:retrieval
npm run perf:smoke
npm run ops:smoke
npm run security:check
```

`npm run package:plugin` creates the manual-install directory. `npm run evals -- --replay --manifest evals/manifests/ci-regression.json` writes a redacted fixture replay under ignored `evals/reports/`.

See [contributing](CONTRIBUTING.md) for fixture, prompt, policy, and quality-gate rules. Repository module boundaries are defined in [AGENTS.md](AGENTS.md).

## Project Documentation

- [Evaluation methodology](EVALS.md)
- [Observability and retained data](OBSERVABILITY.md)
- [Privacy](PRIVACY.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Local models](docs/local-models.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Release compatibility](docs/release-compatibility.md)
- [Architecture](docs/architecture.md), [interfaces](docs/interfaces.md), [runbooks](docs/runbooks.md), and [upgrade notes](docs/upgrade-notes.md)
