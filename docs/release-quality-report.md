# Release Quality Report

## Decision

**No-go.** The release candidate is not ready for Community Plugins submission.
The deterministic Northstar corpus harness and safety gates are implemented,
but Phase 19 manual macOS acceptance and passing live reports for both Ollama
and OpenAI remain required.

## Scope

- Persona: product and project team
- Workflow: Northstar launch planning and delivery
- Platform under validation: macOS with Obsidian desktop
- Local-first provider: Ollama
- Optional cloud provider: OpenAI after explicit acknowledgement
- Corpus: `northstar-release-v1`, 23 reviewed cases

## Automated Evidence

| Evidence                                     | Status                      | Record                                 |
| -------------------------------------------- | --------------------------- | -------------------------------------- |
| Corpus contract and source-range validation  | Passing                     | `tests/evals/release-corpus.test.ts`   |
| Provider grading and unsafe-repair rejection | Passing                     | `tests/evals/release-provider.test.ts` |
| Ollama live corpus report                    | Failing                     | `gemma3:12b`, 2026-07-29               |
| OpenAI live corpus report                    | Pending                     | `evals/reports/northstar-openai.json`  |
| Combined provider gate                       | Pending                     | `npm run eval:marketplace:gate`        |
| Full repository completion gate              | Pending after final changes | Command record                         |

Provider reports must include precision, recall, F1, evidence validity,
unsupported-finding rate, safe-repair validity, median and p95 latency, retries,
incomplete cases/scans, and unsafe-remediation count. Reports contain no API
keys or vault excerpts.

### Current Ollama Measurement

The `gemma3:12b` run against corpus fingerprint
`a24e6482f16b2ad8c68394f9d27830c76487c609f2b1648fd8e1a5b2374a88c3`
did not pass:

| Metric                   |   Result |
| ------------------------ | -------: |
| Precision                |    0.643 |
| Recall                   |    0.818 |
| F1                       |    0.720 |
| Evidence validity        |    0.778 |
| Unsupported-finding rate |    0.357 |
| Safe-repair validity     |    1.000 |
| Median latency           | 3,056 ms |
| p95 latency              | 3,595 ms |
| Retries                  |        1 |
| Incomplete cases/scans   |    1 / 1 |
| Unsafe remediations      |        1 |

This profile must not be described as release-supported. The failed measurement
is evidence for model, prompt, and evaluator refinement; it is not a reason to
lower the safety, evidence, or remediation thresholds.

## Manual macOS Evidence

The following remain pending in `docs/manual-acceptance-checklist.md`:

- fresh install, upgrade, disable/re-enable, and reload;
- narrow and full-pane layouts, light/dark themes, keyboard, and VoiceOver;
- first run, scan, judgment, rejection, repair preview, approval, apply, and
  re-index;
- stale-proposal rejection and provider failure/recovery;
- direct Settings and History plus collapsed Diagnostics;
- Ollama and acknowledged OpenAI passes.

## Release Thresholds

| Metric                   |     Threshold |
| ------------------------ | ------------: |
| Precision                | at least 0.90 |
| Recall                   | at least 0.85 |
| F1                       | at least 0.87 |
| Evidence validity        |          1.00 |
| Unsupported-finding rate |  at most 0.05 |
| Safe-repair validity     |          1.00 |
| Incomplete scans         |             0 |
| Unsafe remediations      |             0 |

Any threshold change requires a dated rationale, reviewer, affected metric, and
new baseline justification in this document.

## Privacy And Safety

Ollama remains loopback-only. OpenAI uses only the fixed API origin, requires
explicit cloud acknowledgement, and sends bounded selected evidence with
`store: false`. Reports and Diagnostics exclude keys, prompts, excerpts, raw
outputs, absolute vault paths, and remote telemetry.

No automatic edits are in scope. Every write requires an exact preview,
explicit approval, complete preflight, revision validation, and post-write
re-index.

## Go Criteria

Change the decision to **go** only when both provider reports pass against the
same corpus fingerprint, the macOS checklist is signed off with no blocker, the
full completion gate passes, package artifacts are verified, public screenshots
match current behavior, and the submission checklist contains no open required
item.
