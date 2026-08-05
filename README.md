# Vault Steward

Continuous integrity checks for local Obsidian vaults.

Vault Steward audits Markdown knowledge bases for broken references, schema problems, task and decision drift, policy violations, and bounded model candidates. It presents cited findings for review and never edits a note without an explicit, revision-safe approval.

## Who It Is For

Vault Steward is for people and teams who keep durable project knowledge in an Obsidian vault and need to find maintenance problems before they become misleading or expensive. It is not a chat-with-your-vault tool: its primary job is integrity, governance, and evidence-backed review.

## Field Engineering Foundations

Vault Steward supports an FDE-style product-validation loop: encode one real
customer workflow as a versioned fixture, label expected findings and
non-findings, run the same workflow across provider profiles, inspect evidence
and execution lineage, and turn field failures into regression gates.

The repository already includes realistic workflow fixtures, deterministic and
model-quality evals, local traces, finding lineage, replay metadata, explicit
approval records, provider comparison reports, and release-quality checks.
These are foundations for fast customer-specific validation, not a claim of
completed multi-customer pilots, a policy-pack catalog, or a published FDE case
study.

## How It Works

```text
Check vault -> deterministic parser and integrity checks
            -> bounded AI triage and target recommendation
            -> deterministic validation and prepared result
            -> explicit approved change -> verified result
```

The everyday flow is deliberately simple: choose a provider once in Settings,
press **Check vault**, review the clearest next recommendation, then approve
only the changes you want. When a safe reference, task, decision, or
duplicate-entity consolidation is available, Vault Steward shows the affected
note and exact **Current** and **After** values.
It also shows current and proposed references, plus the expected result. The one
**Apply fixes** action records your approval, re-checks every source revision,
applies only validated changes, and reports what actually changed.
Non-repairable findings receive a useful next action rather than a made-up
edit.

**Settings** and **History** are directly available after the review surface.
**Diagnostics** keeps model connection, automatic checks, review preferences,
and local trace deletion out of the everyday review path.

## Coordinated Review, Not Autonomous Editing

Vault Steward uses several narrowly scoped agents as a review team. They do
not talk to external tools, write notes, or approve themselves. Deterministic
code validates every input and output, and the user remains the only approval
authority.

| Role                              | What it does                                                                                                   | What keeps it safe                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Scanner and integrity checks      | Parse Markdown, build the vault graph, and find deterministic link, task, schema, policy, and decision issues. | No model or write access.                                                  |
| Semantic reviewers                | Examine bounded, cited evidence for duplicates, contradictions, staleness, ambiguous tasks, and decisions.     | Evidence is treated as untrusted data; outputs must match typed contracts. |
| Coordinator                       | Routes eligible evidence to the right reviewer and records only bounded, metadata-safe results.                | Enforces budgets, retries, and snapshot boundaries.                        |
| Repair guide and canonical ranker | May select from a short list of existing, snapshot-derived targets or abstain.                                 | Cannot invent targets, patch ranges, or operations.                        |
| Approval and apply guard          | Builds the exact preview, checks revisions and conflicts, then applies selected changes.                       | Runs deterministically and only after **Apply fixes**.                     |

The deterministic core owns parsing, policies, evidence validation, finding
normalization, persistence, diffs, expected-result calculation, approval, and
apply decisions. The selected model may classify, rank cited evidence, group
likely duplicates, or choose from bounded existing target candidates. A model
result cannot construct patch ranges, modify a vault, change policy, approve a
proposal, or apply an edit.

## Privacy And Safety

- Runs locally in the Obsidian desktop process with SQLite as the canonical local store.
- Defaults to loopback-configured Ollama or llama.cpp-compatible local model providers for governed scans.
- HyperFusion and OpenAI are optional, experimental cloud providers. Each sends bounded selected evidence and prompts only to its fixed API after the user enters an API key and acknowledges the cloud-data warning.
- Does not send telemetry, traces, metrics, or model output to a cloud service. Cloud API keys are excluded from traces, diagnostics, fingerprints, and exports.
- Stores metadata-only traces by default; note bodies, prompts, raw model outputs, absolute paths, URLs, and secrets are excluded.
- Requires explicit approval and a current source-revision check before every note mutation.
- Treats retrieval, replay, model comparisons, calibration, and policy coverage as informational quality signals, never edit authority.

Read the detailed [privacy statement](PRIVACY.md) and [security guidance](SECURITY.md) before evaluating sensitive vaults.

## What It Checks

- Broken internal links, embeds, and anchors, with safe reference-repair previews where a replacement is unambiguous.
- Narrow task and decision repairs: metadata-confirmed completion, bounded due/owner/project/duplicate-ID updates, broken existing decision associations, and cited short decision rationales.
- Duplicate-entity review with a bounded canonical-note suggestion and explicit link/alias-only consolidation; original notes and their bodies remain intact.
- Markdown/frontmatter schema violations, task integrity problems, unresolved decisions, and deterministic YAML policy violations.
- Bounded local-model candidates for duplicate entities, contradictions, staleness, and ambiguous decisions, subject to citation and schema validation.
- Rename/delete impact, scan history, finding lifecycle, trace lineage, and operational metadata.
- Change-aware maintenance signals for references to renamed/deleted notes and newly superseded decisions. These remain review-only, cite the affected note, and run only within the active Obsidian process.

## Installation

Requirements:

- Node.js 20 or newer for development and packaging.
- Obsidian desktop 1.5.0 or newer.
- Either a running local Ollama service with a configured model, a compatible loopback-only llama.cpp endpoint, or an acknowledged cloud-provider API key.

For manual installation, build the plugin and copy `dist/vault-steward/` into `<vault>/.obsidian/plugins/vault-steward/`, then enable it in Obsidian's community-plugin settings. The package contains `main.js`, `manifest.json`, `styles.css`, `sql-wasm.wasm`, and a release manifest. See [release compatibility](docs/release-compatibility.md) and [troubleshooting](docs/troubleshooting.md) for upgrade and recovery guidance.

## Model Providers

Vault Steward requires a configured model provider for its governed
semantic-analysis stage. Run the in-app readiness check after configuring any
provider and before your first scan.

| Provider    | Where analysis runs                                                 | Setup                                                                                                       |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Ollama      | Your device, through a loopback-only Ollama endpoint.               | Select an installed local model. This is the default path.                                                  |
| llama.cpp   | Your device, through a loopback-only llama.cpp-compatible endpoint. | Select an installed local model.                                                                            |
| HyperFusion | Its fixed `https://api.hyperfusion.io/v1/chat/completions` API.     | Enter an API key and explicitly acknowledge that bounded selected evidence leaves the device. Experimental. |
| OpenAI      | Its fixed `https://api.openai.com/v1/responses` API.                | Enter an API key and explicitly acknowledge that bounded selected evidence leaves the device. Experimental. |

Cloud providers never receive an arbitrary endpoint, telemetry, local traces,
or automatic permission to edit notes. Both cloud paths use bounded requests;
OpenAI requests also set `store: false`.

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

Marketplace release validation uses the versioned 26-case Northstar corpus.
The evaluator runs the actual governed scan: deterministic code owns task,
reference, decision, and policy findings; providers handle semantic agent
routes and bounded reference-target ranking.
Ollama is the local-first release path. HyperFusion remains experimental while
its release evidence matures. OpenAI `gpt-4o-mini` currently passes the same
redacted 26-case corpus and a manual macOS provider check, but remains an
experimental opt-in provider rather than a broad quality guarantee:

```bash
OLLAMA_MODEL=<model> npm run eval:marketplace:ollama
HYPERFUSION_MODEL=qwen/qwen3-32b HYPERFUSION_API_KEY=<key> HYPERFUSION_CLOUD_ACKNOWLEDGED=true npm run eval:marketplace:hyperfusion
OPENAI_MODEL=<model> OPENAI_API_KEY=<key> OPENAI_CLOUD_ACKNOWLEDGED=true npm run eval:marketplace:openai
npm run eval:marketplace:gate
```

Provider reports contain case IDs, outcomes, aggregate metrics, latency,
retries, and failure codes. They exclude API keys and vault excerpts. The
current release status and unmet evidence are recorded in the
[release quality report](docs/release-quality-report.md).

Reproducible synthetic and fixture benchmark instructions are in
[BENCHMARKS.md](BENCHMARKS.md). Benchmark results remain local and describe only
the recorded model, configuration, fixture, and hardware conditions.

Fixture replay writes a redacted local record to `evals/reports/replay.json`. Controlled comparisons accept the same fixture manifest with exactly one changed configuration value: model, prompt, threshold, retrieval, policy, or agent. Live scans retain metadata rather than historical source by default, so they report replay eligibility instead of reconstructing old notes.

Generated scale evaluation currently measures the deterministic reference family against exact synthetic ground truth. Retrieval metrics, policy coverage, model comparisons, and calibration describe recorded conditions only; they do not select a model or alter product behavior. See [evaluation methodology](EVALS.md) and [observability and retained data](OBSERVABILITY.md).

## Limitations

- Vault Steward cannot establish objective truth or verify external facts without an external source.
- It can miss implicit contradictions and may produce false positives, especially with smaller models or weak note structure.
- Staleness and decision quality are contextual; evidence quality depends on note quality.
- No model output is sufficient on its own to authorize a change.
- Duplicate review never merges notes, selects a canonical note automatically, or deletes either original note.
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
- [Complex acceptance vault](docs/complex-acceptance-vault.md)
- [Release compatibility](docs/release-compatibility.md)
- [Northstar release workflow](docs/northstar-release-workflow.md)
- [Release quality report](docs/release-quality-report.md)
- [Submission checklist](docs/community-plugin-submission-checklist.md)
- [Architecture](docs/architecture.md), [interfaces](docs/interfaces.md), [runbooks](docs/runbooks.md), and [upgrade notes](docs/upgrade-notes.md)
