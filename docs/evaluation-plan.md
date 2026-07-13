# Evaluation Plan

## Principles

Use deterministic graders first. Keep development, CI, held-out, and human-review datasets separate. Version dataset, prompt, model, schema, grader, and baseline together. A failing safety, schema-validity, or unsupported-evidence gate blocks promotion regardless of aggregate quality.

## Evaluation Inventory

| Component                 | Core metrics                                         | Initial gate                                            |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| entity candidates         | precision, recall, evidence validity                 | evidence validity 100%; precision >= 0.90 on golden set |
| contradiction candidates  | evidence validity, supported-claim precision, recall | validity 100%; precision >= 0.85                        |
| staleness candidates      | precision/recall, policy adherence                   | precision >= 0.80; zero policy bypasses                 |
| decision candidates       | extraction F1, citation validity                     | citation validity 100%; F1 >= 0.85                      |
| coordinator ranking       | NDCG@10, duplicate suppression, severity invariants  | no duplicate or severity invariant failures             |
| agent workflow            | route, handoff, tool-argument, termination accuracy  | 100% schema/tool-permission/loop-limit compliance       |
| local-provider resilience | malformed-output recovery, timeout recovery          | fail closed; no state corruption                        |

Thresholds are starting gates to calibrate against expert review before a general release. Regression fails when a safety invariant breaks, a gate falls below threshold, or a primary metric drops by more than 0.03 absolute from its versioned baseline without an approved update.

The initial deterministic `reference-integrity` baseline records evidence validity, precision, and recall of 1.0 against the synthetic fixture dataset. It runs through `npm run eval:smoke` and `npm run eval:full`.

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

## Runtime Efficiency Metrics

Report input/output tokens, token per valid finding, repeated-context ratio, retrieved-context utilization, model latency, tool calls, retries, and incomplete-rate. Default budgets from `docs/ai-system.md` are hard limits; a 20% increase in p95 token use or latency versus baseline is an investigation gate.
