# Release Quality Report

## Decision

**No-go.** The release candidate is not ready for Community Plugins submission.
The deterministic Northstar corpus harness and safety gates are implemented,
but Phase 19 manual macOS acceptance and a passing Ollama report remain
required. HyperFusion has a passing corpus report but still requires manual
macOS acceptance before a support claim. OpenAI is deferred.

## Scope

- Persona: product and project team
- Workflow: Northstar launch planning and delivery
- Platform under validation: macOS with Obsidian desktop
- Local-first provider: Ollama
- Cloud validation priority: HyperFusion after explicit acknowledgement
- Deferred cloud provider: OpenAI
- Corpus: `northstar-release-v1`, 26 reviewed cases

## Automated Evidence

| Evidence                                     | Status  | Record                                 |
| -------------------------------------------- | ------- | -------------------------------------- |
| Corpus contract and source-range validation  | Passing | `tests/evals/release-corpus.test.ts`   |
| Provider grading and unsafe-repair rejection | Passing | `tests/evals/release-provider.test.ts` |
| Ollama live corpus report                    | Passing | `gemma3:12b`, 2026-07-29               |
| HyperFusion live corpus report               | Passing | `qwen/qwen3-32b`, 2026-08-03           |
| Ollama marketplace gate                      | Pending | `npm run eval:marketplace:gate`        |
| Full repository completion gate              | Passing | 2026-07-29 command record              |

Provider reports must include precision, recall, F1, evidence validity,
unsupported-finding rate, safe-repair validity, median and p95 latency, retries,
incomplete cases/scans, and unsafe-remediation count. Reports contain no API
keys or vault excerpts.

Generate the current local, redacted gate summary with `npm run release:quality`.
It writes the ignored `evals/reports/release-quality.json` artifact and defaults
to **no-go** unless fixture evaluation, the Ollama report, and manual Obsidian
acceptance are all supplied as passing evidence. HyperFusion and OpenAI reports
remain separately recorded cloud-validation evidence. The command never
uploads or publishes the artifact.

### Current Ollama Measurement

The `gemma3:12b` governed-pipeline run against corpus fingerprint
`1eb4fe837a7554fe1c3818effa352316162062f315e065a99040a8776e28fdd3`
passed:

| Metric                   |    Result |
| ------------------------ | --------: |
| Precision                |     1.000 |
| Recall                   |     1.000 |
| F1                       |     1.000 |
| Evidence validity        |     1.000 |
| Unsupported-finding rate |     0.000 |
| Safe-repair validity     |     1.000 |
| Median latency           |  4,138 ms |
| p95 latency              | 15,118 ms |
| Retries                  |         1 |
| Incomplete cases/scans   |     0 / 0 |
| Unsafe remediations      |         0 |

The run executed the full immutable fixture through the actual governed scan:
14 deterministic findings, zero accepted semantic findings, and one bounded
repair recommendation across four model invocations. This result validates the
current Northstar fixture only. Its semantic cases are hard negatives and
abstentions, so it is not evidence of broad contradiction or staleness recall.

An earlier 23-case result is superseded because its runner incorrectly asked the
model to decide deterministic task, reference, decision, and policy outcomes.
No safety, evidence, or remediation threshold was lowered.

### Current HyperFusion Measurement

The `qwen/qwen3-32b` governed-pipeline run against the same Northstar corpus
passed on 2026-08-03. It recorded precision, recall, F1, evidence validity,
and safe-repair validity of `1.000`, an unsupported-finding rate of `0.000`,
zero incomplete cases/scans, and zero unsafe remediations. Median latency was
823 ms and p95 latency was 8,416 ms, with no retries in the passing run.

This is redacted synthetic-corpus evidence only. HyperFusion remains
validation-in-progress until its manual macOS acknowledgement, recovery, and
review-flow acceptance pass is complete.

## Manual macOS Evidence

The following remain pending in `docs/manual-acceptance-checklist.md`:

- fresh install, upgrade, disable/re-enable, and reload;
- narrow and full-pane layouts, light/dark themes, keyboard, and VoiceOver;
- first run, scan, judgment, rejection, repair preview, approval, apply, and
  re-index;
- stale-proposal rejection and provider failure/recovery;
- direct Settings and History plus collapsed Diagnostics;
- Ollama pass and HyperFusion manual validation pass before HyperFusion is described as supported.

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

Ollama remains loopback-only. HyperFusion uses only the fixed Chat Completions
origin and requires explicit cloud acknowledgement. OpenAI remains a separate,
unvalidated fixed-origin opt-in. Reports and Diagnostics exclude keys, prompts,
excerpts, raw outputs, absolute vault paths, and remote telemetry.

No automatic edits are in scope. Every write requires an exact preview,
explicit approval, complete preflight, revision validation, and post-write
re-index.

## Go Criteria

Change the decision to **go** only when the Ollama report passes against the
expected corpus fingerprint, the macOS checklist is signed off with no blocker,
the full completion gate passes, package artifacts are verified, public
screenshots match current behavior, and the submission checklist contains no
open required item. HyperFusion requires its own passing corpus and manual
evidence before a support claim.
