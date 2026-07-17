# Phase 15: Replay and Comparative Analysis Design

## Status

Approved design. Phase 15 is split into two ordered implementation slices:
replay/comparison first, then model-quality and calibration built on the stable
replay artifacts.

## Problem

Phase 14 creates local, redacted evaluation reports and protected fixture splits,
but users cannot yet answer whether a prior scan can be replayed, why a replay is
impossible, or what changed when exactly one configuration variable changes.
Existing scan history deliberately does not retain historical note bodies. This is
a privacy property, not a gap to work around.

## Goals

- Determine whether a persisted live scan has enough metadata for exact replay.
- Explain exact-replay ineligibility without exposing vault content or paths.
- Re-run synthetic fixture cases under a recorded configuration and compare
  findings, evidence locators, severity, validation outcomes, duration, memory,
  token estimates, and failure codes.
- Permit a comparison only when exactly one declared variable differs: model,
  prompt, threshold, retrieval configuration, policy, or agent version.
- Produce local, redacted comparison reports suitable for later model comparison
  and confidence calibration.

## Non-Goals

- Reconstructing historical vault note content or making live-scan replay appear
  possible when it is not.
- Calling a remote service or sending telemetry.
- Allowing replay output, model comparison, or confidence values to authorize
  a repair or change policy.
- Building synthetic scale generation, retrieval evaluation, or a plugin UI in
  this phase.

## Architecture

### Live scan eligibility

`assessLiveReplayEligibility` receives only metadata retained by trace and scan
repositories. It checks snapshot, changed-file, plugin, parser, agent, schema,
policy, prompt, model, and retrieval fingerprints. A scan is `eligible` only if
all required identifiers are present and its source snapshot is retained by an
explicit replay source. Current persisted live scans normally return
`unavailable-source-content`; the UI and reports must state that historical vault
content was intentionally not retained.

### Fixture replay

`replayFixtureEvaluation` loads a Phase 14 fixture manifest and runs the same
family evaluator. A replay record contains only case IDs, configuration metadata,
metrics, safe error codes, and timing/resource aggregates. It never serializes
fixture Markdown, prompts, raw local-model responses, absolute paths, URLs, or
secrets.

### Controlled comparison

`compareReplayRuns` accepts a baseline and candidate replay record. It calculates
the changed configuration keys and accepts exactly one key from the approved set.
It returns a typed redacted diff for findings added/removed, severity and evidence
locator changes, validation changes, metric deltas, and failure changes. Zero or
multiple changed keys return a user-safe rejected comparison result.

## Contracts

```ts
type ReplayVariable =
  | "model"
  | "prompt"
  | "threshold"
  | "retrieval"
  | "policy"
  | "agent";

type LiveReplayEligibility =
  | { eligible: true; scanId: string; source: "retained-fixture" }
  | { eligible: false; scanId: string; reasons: ReplayIneligibilityReason[] };

type FixtureReplayRecord = {
  schemaVersion: 1;
  replayId: string;
  sourceReportId: string;
  fixtureManifestHash: string;
  configuration: Record<ReplayVariable, string>;
  caseResults: RedactedReplayCaseResult[];
  metrics: EvaluationReport["metrics"];
  runtime: RedactedRuntimeMetrics;
};
```

All identifiers are bounded strings. Validators reject content-bearing fields and
unknown configuration keys. A replay is not a scan snapshot and cannot be passed
to review/proposal/apply modules.

## Data Flow

```text
Trace metadata -> eligibility assessment -> eligible / explicit reason

Fixture manifest + configuration -> fixture evaluator -> replay record
baseline replay + candidate replay -> single-variable validation -> redacted diff
```

## Errors and Safety

- Missing source content returns an explicit ineligible result; it never falls
  back to the current vault.
- Manifest mismatch, invalid report, unknown variable, duplicate variable, and
  any content-bearing field fail before comparison.
- A comparison result is informational. Deterministic evidence, policy,
  validation, approval, and stale-revision controls remain unchanged.

## Testing and Acceptance Criteria

1. Eligibility tests cover each missing fingerprint and the retained-source
   success path; outputs contain no note content or absolute paths.
2. Fixture replay tests prove deterministic re-execution, metadata redaction,
   stable replay identity, and failure reporting.
3. Comparison tests prove added/removed finding output, evidence/severity and
   validation deltas, accepted single-variable changes, and rejected zero/multi
   variable changes.
4. Contract tests reject malformed records and content-bearing configuration.
5. Completion requires focused tests, format, lint, typecheck, build, existing
   deterministic evaluations, security checks, documentation updates, and an
   interactive explanation after the phase is complete.

## Deferred Slice

After replay/comparison is stable, Phase 15B will add model comparison reports by
task and hardware profile plus confidence calibration against protected human
labels. Calibration may warn about poorly calibrated profiles but cannot change
finding severity or authorize any repair.
