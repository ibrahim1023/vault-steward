# Policy Studio and Evidence-Bounded Local Intelligence Design

## Purpose

Phase 9 makes policy authoring, model readiness, explanations, model-quality evidence, and reviewer feedback visible without weakening Vault Steward's local-first and evidence-first guarantees.

## Scope

The phase delivers five bounded capabilities:

1. A single file-backed Policy Studio for a vault-local YAML policy document.
2. A selected-finding explanation request that receives only the selected finding's cited evidence and typed metadata.
3. A local-model readiness check and per-vault profile for the configured provider.
4. Redacted deterministic and human-review evaluation reports for model-assisted quality.
5. Local reviewer feedback records for findings and proposals, plus aggregate quality reports and policy-tuning hints.

## Policy Studio

The active policy lives at the vault-relative fixed path `.vault-steward/policy.yaml`. The studio reads that file through the vault adapter. A missing file opens as an editable, valid starter policy; it is not created until the user explicitly saves.

Draft YAML is parsed with the existing bounded `parsePolicy` contract on every edit. Invalid drafts show diagnostics and cannot be saved or previewed. A valid draft can be previewed against the most recent completed snapshot by extracting typed frontmatter facts and evaluating the parsed policy. Preview data remains ephemeral and never creates findings, changes scan state, or writes policy records. Saving revalidates the exact draft and writes only the configured vault-relative policy path.

## Finding Explanation

The dashboard's selected-finding detail view includes an explicit Explain evidence action. It builds a fixed prompt from the selected finding's type, severity, deterministic explanation, policy identifier, and cited evidence only. It cannot search the vault, receive a live note body outside cited excerpts, invoke tools, create a finding, change policy, or write files. The response is capped, rendered as untrusted text, and discarded when selection changes or the view closes.

## Model Profile and Readiness

The plugin profile extends the existing per-vault settings with bounded request timeout and maximum response bytes. A readiness check sends a fixed synthetic structured-output request through the configured loopback provider and reports provider/model identity, structured-output success, measured latency, configured limits, and a redacted failure code. It does not persist prompts or outputs. A failed readiness check does not permit a governed scan to complete without the required model stage.

## Evaluation

Model-assisted fixture cases gain split and review metadata. Deterministic graders report citation validity, structured-output validity, precision, recall, F1, false-positive and false-negative counts, severity agreement, and unsupported-claim rate. Reports include only case IDs, aggregate metrics, versions, profile metadata, and timing: never note text, prompts, or outputs. Thresholds stay deterministic; human review and model-as-judge inputs inform reports but never bypass citation validation.

## Reviewer Feedback

The selected-finding UI accepts a local verdict: false positive, useful, or needs review, plus an optional short user-authored label. The repository stores the finding ID, optional proposal ID, verdict, label, and timestamp. It rejects unknown verdicts and labels over the fixed limit. Aggregate reports count verdicts by finding type and policy ID and may suggest reviewing policies that accumulate false-positive feedback. Feedback never directly changes findings, policies, ranking, or model prompts.

## Security and Privacy

- All provider calls use the existing loopback-only provider abstraction.
- The explanation context is an allowlist assembled from the selected `Finding`; no vault search or tool interface exists.
- Policy paths are fixed and vault-relative; traversal is rejected before adapter access.
- Draft policy content is held in UI memory only until explicit save.
- Evaluation reports, readiness results, and feedback records exclude vault note bodies, prompt text, raw model output, absolute paths, and secrets.
- A failed model action produces a redacted diagnostic and makes no mutation.

## Testing

Unit tests cover draft parsing, policy preview, fixed-path validation, explanation context construction, readiness classification, feedback validation, graders, and report redaction. Integration tests cover policy file read/save, feedback persistence, and migration. UI tests cover disabled actions, preview rendering, explanation lifecycle, readiness recovery, and feedback submission. The Phase 9 completion gate includes static checks, unit/integration/E2E/acceptance tests, deterministic evals, packaging/install smoke, and security checks.
