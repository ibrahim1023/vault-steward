# Release Quality Report

## Decision

**No-go.** The release candidate is not ready for Community Plugins submission.
The deterministic Northstar corpus, provider reports, and safety gates pass,
but final manual sign-off, release materials, and submission evidence remain
incomplete. HyperFusion and OpenAI are experimental opt-in providers, not
marketplace support claims.

## Scope

- Persona: product and project team
- Workflow: Northstar launch planning and delivery
- Platform under validation: macOS with Obsidian desktop
- Local-first provider: Ollama
- Experimental cloud providers: HyperFusion and OpenAI after explicit acknowledgement
- Corpus: `northstar-release-v1`, 26 reviewed cases

## Automated Evidence

| Evidence                                     | Status  | Record                                                 |
| -------------------------------------------- | ------- | ------------------------------------------------------ |
| Corpus contract and source-range validation  | Passing | `tests/evals/release-corpus.test.ts`                   |
| Provider grading and unsafe-repair rejection | Passing | `tests/evals/release-provider.test.ts`                 |
| Ollama live corpus report                    | Passing | `qwen3:8b`, 2026-08-05                                 |
| HyperFusion live corpus report               | Passing | `qwen/qwen3-32b`, 2026-08-03                           |
| OpenAI live corpus report                    | Passing | `gpt-4o-mini`, 2026-08-05                              |
| Marketplace gate                             | Passing | Ollama and OpenAI, same corpus fingerprint, 2026-08-05 |
| Full repository completion gate              | Passing | 2026-08-05 command record                              |

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

The `qwen3:8b` governed-pipeline run against corpus fingerprint
`d693cc1…81552a0`
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

This is redacted synthetic-corpus evidence only. HyperFusion remains an
experimental opt-in provider while its remaining manual safety checks mature.

### Current OpenAI Measurement

The `gpt-4o-mini` governed-pipeline run against the same Northstar corpus
passed on 2026-08-05: all 26 cases passed with precision, recall, F1, evidence
validity, and safe-repair validity of `1.000`; no incomplete scans or unsafe
remediations were recorded. Manual connection, governed scan, acknowledgement
blocking, invalid-key redaction, recovery, and provider-switch checks also
passed. OpenAI remains experimental.

## Manual macOS Evidence

Manual acceptance is signed off in `docs/manual-acceptance-checklist.md` as of
2026-08-05. The remaining release evidence is:

- release screenshots, demonstration, and package/version/tag evidence;
- a release-owner review after the final completion gate;
- completion of the full source security review.

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

Ollama remains loopback-only. HyperFusion and OpenAI use only their fixed API
origins and require explicit cloud acknowledgement. Both cloud paths are
experimental. Reports and Diagnostics exclude keys, prompts, excerpts, raw
outputs, absolute vault paths, and remote telemetry.

No automatic edits are in scope. Every write requires an exact preview,
explicit approval, complete preflight, revision validation, and post-write
re-index.

## Go Criteria

Change the decision to **go** only when the local-first Ollama report passes
against the expected corpus fingerprint, the macOS checklist is signed off with
no blocker, the full completion gate passes, package artifacts are verified,
public screenshots match current behavior, and the submission checklist contains
no open required item. Experimental cloud providers require their own passing
corpus and manual evidence before a support claim.
