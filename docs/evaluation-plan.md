# Evaluation Plan

## Principles

Use deterministic graders first. Keep development, CI, held-out, and human-review datasets separate. Version dataset, prompt, model, schema, grader, and baseline together. A failing safety, schema-validity, or unsupported-evidence gate blocks promotion regardless of aggregate quality.

## Evaluation Inventory

| Component                  | Core metrics                                                   | Initial gate                                            |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| entity candidates          | precision, recall, evidence validity                           | evidence validity 100%; precision >= 0.90 on golden set |
| contradiction candidates   | evidence validity, supported-claim precision, recall           | validity 100%; precision >= 0.85                        |
| staleness candidates       | precision/recall, policy adherence                             | precision >= 0.80; zero policy bypasses                 |
| decision candidates        | extraction F1, citation validity                               | citation validity 100%; F1 >= 0.85                      |
| coordinator ranking        | NDCG@10, duplicate suppression, severity invariants            | no duplicate or severity invariant failures             |
| agent workflow             | route, handoff, tool-argument, termination accuracy            | 100% schema/tool-permission/loop-limit compliance       |
| local-provider resilience  | malformed-output recovery, timeout recovery                    | fail closed; no state corruption                        |
| marketplace release corpus | precision, recall, F1, evidence, repairs, provider reliability | both providers pass; zero unsafe remediations           |

Thresholds are starting gates to calibrate against expert review before a general release. Regression fails when a safety invariant breaks, a gate falls below threshold, or a primary metric drops by more than 0.03 absolute from its versioned baseline without an approved update.

The initial deterministic `reference-integrity` baseline records evidence validity, precision, and recall of 1.0 against the synthetic fixture dataset. It runs through `npm run eval:smoke` and `npm run eval:full`.

The `model-quality` report grades the split model-assisted fixtures with deterministic candidate, citation, schema, severity, false-positive/negative, precision, recall, F1, and unsupported-claim metrics. Reports contain only case IDs, aggregate metrics, versions, and split labels; they never contain note bodies, prompt text, or raw model output.

The versioned Northstar release corpus adds 26 realistic cases over one
product/project workflow. It explicitly labels positive findings, hard
negatives, abstentions, source ranges, severity, and repair eligibility.
The runner executes the governed scan over the complete immutable fixture
snapshot. Deterministic checks own task, reference, decision, and policy
outcomes; model output is accepted only through semantic-agent validators and
the bounded reference-target selector. Ollama and OpenAI run independently
against the same fingerprint. Release
thresholds are precision 0.90, recall 0.85, F1 0.87, evidence validity 1.00,
unsupported-finding rate at most 0.05, safe-repair validity 1.00, zero
incomplete scans, and zero unsafe remediations.

## Dataset and Infrastructure Layout

```text
evals/
  datasets/     # JSONL cases and split manifests
  fixtures/     # synthetic vaults and expected evidence locators
  graders/      # deterministic validators and optional calibrated judges
  scenarios/    # multi-agent/tool trace inputs
  baselines/    # versioned aggregate results
  reports/      # generated, ignored-by-default local reports
```

A case declares `id`, `split`, fixture reference, task, expected evidence, expected constraints, optional human label, and contamination status. A result declares versions, case ID, trace summary, metrics, token/latency/tool usage, and failure codes. Deterministic graders validate schema, source locators, policy, state transitions, tool trace, and evidence-presence. Model judges are permitted only for usefulness/ambiguity after a rubric, structured output, calibration against human labels, blinded ordering, and sampled human spot checks.

## Evaluation Sets

- Development: small, visible examples for rapid iteration.
- CI regression: fixed deterministic and short model-free scenarios.
- Held-out: larger examples excluded from prompt design.
- Adversarial: injection, conflicting metadata, malformed output, large context, tool failure, and loop-pressure cases.
- Human review: ambiguous contradiction/staleness and proposal usefulness samples with agreement tracking.

## Seeded Synthetic Scale Coverage

`npm run eval:synthetic` generates a disposable local vault from a bounded seed/configuration and evaluates the generated reference defects against exact redacted ground truth. The initial scale report measures the deterministic reference family only; other injected defect kinds provide labelled inputs for later family-specific evaluators and must not be presented as measured agent accuracy. Generated vaults and reports are ignored by Git.

## Optional Retrieval Quality

Configured local retrieval adapters may be evaluated with bounded query, evidence-ID, score, cache-state, and latency metadata. The local report measures query coverage, relevant-evidence rate, cache-hit rate, score distribution, missing queries, and p50/p95 latency. No configured adapter yields an explicit `not-configured` result. Retrieval remains optional and derived: these metrics never authorize findings, evidence, policies, proposals, approvals, or edits.

## Policy Coverage

Local policy coverage summarizes policy/version execution, triggered violations, explicit fixture coverage, deprecation, and aggregate reviewer false-positive rates. It distinguishes missing review data from a zero false-positive rate and orders its status deterministically: deprecated, unexercised, missing fixture, review needed, then covered. Its suggestions identify follow-up work only; it never changes policy YAML or policy storage.

## Reproducible Fixture Runner

`npm run evals` runs the versioned fixture-vault cases under `evals/cases/`. Each case declares a bounded expected finding, source locator, severity, fix applicability, family, split, and contamination metadata. Fixtures cover references, entities, contradictions, staleness, tasks, schemas, policies, and decisions.

The runner supports `--suite`, `--agent`, `--case`, `--split`, `--model-profile`, `--manifest`, and `--compare`. Reports are written locally to ignored `evals/reports/framework.json`. They record only identifiers, aggregate metrics, configuration fingerprints, plugin/parser/grader versions, prompt/policy/schema version labels, model profile, fixture manifest hash, and hardware metadata.

CI uses the fixed `ci-regression` manifest and baseline comparison. It fails critical fixture cases, invalid evidence/schema/routing/termination results, unsupported claims, unapproved precision/recall/F1 regressions, and unapproved p95 latency or peak-memory growth. A metric exception requires a recorded author, date, rationale, and named metric.

Every baseline comparison also writes a local redacted `evals/reports/regression.json`
artifact containing report IDs, manifest hash, pass/fail status, failures, and whether
a dated rationale was used. It contains neither fixture contents nor vault data.

Held-out and human-review cases are rejected if marked development-visible. Human labels are summarized only as aggregate independently-reviewed sample counts, agreement, and unresolved counts. Model-assisted assessment can inform usefulness review but cannot satisfy the deterministic evidence, schema, routing, or termination safety gates on its own.

## Replay And Local Model Comparison

Fixture replay re-runs the same synthetic cases, manifest, and configuration bundle through the deterministic evaluator. A comparison is accepted only when the two redacted records have the same fixture manifest and exactly one declared configuration value differs: model, prompt, threshold, retrieval, policy, or agent. Live vault scans are eligible only when their historical source is an explicitly retained synthetic fixture; ordinary vault scans record metadata-only eligibility and cannot be reconstructed from stored telemetry.

Local model comparison groups accepted, redacted replay measurements by agent task, fixture family, vault scale, model metadata, and hardware profile. It reports precision, recall, F1, evidence validity, p50/p95 latency, peak memory, retries, and incomplete rate. These reports are descriptive comparisons for the recorded conditions, not a universal ranking or a mechanism for selecting a default model.

Confidence calibration uses only adjudicated human labels and groups samples by agent, finding type, and fixed confidence range. It reports observed accuracy plus overconfidence and underconfidence gaps. A warning requires at least five labels and an absolute gap greater than 0.15; it is a quality-review signal only and never authorizes a repair, policy change, severity change, or automatic model selection.

## Runtime Efficiency Metrics

Report input/output tokens, token per valid finding, repeated-context ratio, retrieved-context utilization, model latency, tool calls, retries, and incomplete-rate. Default budgets from `docs/ai-system.md` are hard limits; a 20% increase in p95 token use or latency versus baseline is an investigation gate.

## Marketplace Provider Commands

```bash
OLLAMA_MODEL=<model> npm run eval:marketplace:ollama
OPENAI_MODEL=<model> OPENAI_API_KEY=<key> OPENAI_CLOUD_ACKNOWLEDGED=true npm run eval:marketplace:openai
npm run eval:marketplace:gate
```

Missing configuration, missing cloud acknowledgement, provider failure,
malformed output, unknown evidence/candidate IDs, an unsafe remediation,
fingerprint mismatch, or a missing provider report fails closed. Threshold
changes require a dated rationale in `docs/release-quality-report.md`.

## Performance Release Gate

`npm run perf:smoke` uses a fixed synthetic fixture with 250 Markdown notes and 50 attachments. The versioned baseline in `evals/baselines/performance.json` requires at least 300 files and 50 attachments, a full deterministic scan below 10 seconds, a one-file incremental reparse below 1 second, heap growth below 128 MiB, and SQLite export size below 20 MiB. The command writes its measurements to the ignored `evals/reports/performance.json` and fails on any threshold regression. Run it in release review and CI environments where the synthetic fixture is representative.

## Operational Release Gate

`npm run ops:smoke` writes a redacted operational report to `evals/reports/operational.json`. Its versioned baseline gates scan duration, parse errors, model latency, token usage, tool calls, retry rate, incomplete rate, finding volume, stale proposals, and apply failure rate. The current smoke path uses a deterministic local provider fixture so this report validates the format and thresholds without sending vault data or requiring a live model.
