# Phase 14: Reproducible Evaluation and Regression Framework Design

## Status

Approved design. This document defines deterministic, local evaluation
infrastructure for Phase 14. It deliberately does not implement live-model
comparison, replay, synthetic scale generation, or remote evaluation services.

## Problem

Vault Steward has small JSONL datasets and deterministic reference/model-quality
graders, but they do not yet share a common case contract, report metadata,
selection interface, or regression-comparison mechanism. A quality claim therefore
cannot reliably answer which fixture, split, model profile, grader, prompt,
configuration, and baseline produced it.

The framework must make changes to parser, policy, agent routing, prompt version,
or local-model configuration measurable without sending vault content outside the
machine or allowing model-as-judge output to become a safety authority.

## Goals

- Standardize fixture-vault cases and expected results for every current finding
  family: references, entities, contradictions, staleness, tasks, schemas,
  policies, and decisions.
- Grade deterministic facts first: finding identity, evidence/source ranges,
  severity, schema validity, routing, termination, and safe-fix applicability.
- Emit redacted, versioned local reports that can be selected and compared by
  suite, agent, model profile, case, split, and baseline.
- Block regression on critical fixture failure, invalid evidence/schema/routing,
  unsupported findings, unapproved threshold changes, and meaningful metric
  regressions.
- Protect held-out cases from development selection and keep human-review labels
  separate from automated grades.

## Non-Goals

- Calling Ollama or any external service in a default evaluation command.
- Treating a model's free-form assessment as a safety, correctness, or promotion
  gate.
- Storing fixture note bodies, prompts, or raw output in generated reports.
- Replaying historical live vault scans; Phase 15 owns replay.
- Generating large random vaults; Phase 16 owns synthetic-scale generation.

## Product Shape

Phase 14 extends the existing `evals/` workspace rather than replacing it:

```text
evals/
  cases/<family>/<case-id>/
    vault/                  # synthetic Markdown fixture
    expected.json           # expected findings, evidence, constraints
    metadata.json           # split, contamination, versions, labels
  manifests/
    development.json
    ci-regression.json
    held-out.json
    adversarial.json
    human-review.json
  baselines/
  reports/                  # ignored generated local reports
```

Existing JSONL datasets may remain as compatibility inputs during migration, but
the runner converts them to the same in-memory `EvaluationCase` contract. Every
new case lives in a directory so the vault fixture, expected result, and metadata
remain reviewable together.

## Contracts

### Evaluation case

```ts
type EvaluationSplit =
  "development" | "ci-regression" | "held-out" | "adversarial" | "human-review";

type EvaluationCase = {
  schemaVersion: 1;
  id: string;
  family:
    | "reference"
    | "entity"
    | "contradiction"
    | "staleness"
    | "task"
    | "schema"
    | "policy"
    | "decision";
  split: EvaluationSplit;
  agent?: string;
  fixturePath: string;
  expected: ExpectedFinding[];
  contamination: { developmentVisible: boolean; reason: string };
  humanLabel?: { labelId: string; adjudicated: boolean };
};
```

`fixturePath` is repository-relative and validated against traversal. An expected
finding names only fixture-relative paths, source ranges/locators, deterministic
type/severity/status, policy/validator constraints, and expected safe-fix state.
It never carries raw prompt text or model output.

### Report

```ts
type EvaluationReport = {
  schemaVersion: 1;
  reportId: string;
  createdAt: string;
  selection: {
    suite: string;
    caseIds: string[];
    split: EvaluationSplit[];
    agent?: string;
    modelProfile?: string;
  };
  provenance: {
    pluginVersion: string;
    parserVersion: string;
    promptVersions: string[];
    policyVersions: string[];
    graderVersion: string;
    fixtureManifestHash: string;
    configurationFingerprint: string;
    hardware: HardwareProfile;
  };
  metrics: EvaluationMetrics;
  cases: RedactedCaseResult[];
};
```

Reports carry aggregate values and IDs only. `HardwareProfile` contains platform,
CPU architecture, memory total, and runtime version, never username or absolute
path. `RedactedCaseResult` holds the case ID, outcome, counts, safe error code,
and timing/token/retry figures, never note text.

## Grading and Metrics

The runner composes small deterministic graders. A family-specific grader produces
predicted findings; shared graders then measure:

- precision, recall, F1, false positives, and false negatives;
- evidence presence, evidence-source, and source-range accuracy;
- unsupported-claim rate and severity agreement;
- suggested-fix validity and safe non-applicability;
- structured-output and schema validation success;
- agent route, handoff, tool-permission, retry, and termination compliance;
- median/p95 latency, token totals, retry rate, incomplete rate, and peak-memory
  measurement when the runtime supports it.

Metric denominators are explicit. Empty populations return `null`/`not applicable`
rather than a misleading `1.0`. A critical case is an expected safety invariant
such as rejected unsupported evidence, invalid schema, forbidden tool route, or
unsafe proposal.

## CLI

`npm run evals` becomes the canonical command and delegates to a typed runner.
It accepts:

```text
npm run evals -- --suite reference --split ci-regression
npm run evals -- --agent contradiction --case contradictions-basic-001
npm run evals -- --model-profile ollama-llama31-8b --compare evals/baselines/main.json
npm run evals -- --manifest evals/manifests/adversarial.json
```

The default selection excludes held-out and human-review cases. Selecting either
requires explicit `--split held-out` or `--split human-review`; development commands
cannot silently include them. `--model-profile` records metadata in the report but
does not start a provider call in Phase 14. Unknown, duplicate, incompatible, or
empty selections fail with user-safe errors.

## Baselines and Regression Gates

Baselines are checked-in redacted `EvaluationReport` summaries with a threshold
policy beside them. The comparator aligns only reports sharing the same evaluator
schema and declared fixture manifest. It reports added/removed cases and metric
deltas, then fails when:

- a critical case fails;
- evidence/source/schema/routing/termination validity falls below 100%;
- unsupported finding rate rises above zero;
- precision drops by more than 0.02, recall by more than 0.03, or F1 by more than
  0.02 without a recorded threshold-rationale file;
- p95 latency rises more than 20% or peak memory more than 25% for a comparable
  deterministic run; or
- a baseline changes without an explicit rationale containing author, date,
  affected metrics, and review reason.

CI runs development and `ci-regression` deterministic cases. Held-out,
adversarial, and human-review manifests run locally or in separately protected
jobs; their cases are not surfaced through development-suite listing.

## Dataset Governance

- Development cases are visible and may inform implementation.
- CI regression cases are fixed and reviewable but should only change with a
  regression rationale.
- Held-out cases set `developmentVisible: false`; the runner rejects them when
  invoked from a development manifest or a prompt-development command.
- Adversarial cases exercise injection, malformed output, conflicting metadata,
  failed tools, and termination pressure.
- Human-review cases contain label IDs and adjudication state. Agreement reporting
  uses aggregate label counts, sampled pairwise agreement, and unresolved-label
  counts, never free-form reviewer comments in reports.

Model-as-judge may later produce a separately labelled usefulness signal, but a
deterministic evidence/schema/policy gate must independently pass before that
signal is visible or used.

## Implementation Boundaries

- New public evaluation contracts live under `src/contracts/` or `evals/contracts/`
  and have runtime validators.
- Fixture loaders use strict repository-relative path validation and only the
  synthetic `evals/cases` root.
- Graders are pure functions; runner I/O, report writing, and hardware collection
  live under `evals/` and `scripts/`.
- CI uses the new deterministic runner. No plugin UI, SQLite schema, vault adapter,
  or external package is required for Phase 14.
- The report writer redacts/rejects strings that resemble note bodies, prompts,
  secrets, URLs, or absolute local paths.

## Test Strategy and Acceptance Criteria

1. Contract tests reject malformed case/report metadata, traversal paths,
   content-bearing report fields, invalid split/contamination combinations, and
   empty/duplicate IDs.
2. Fixture-loader tests cover all eight families, expected locator matching, and
   missing/corrupt fixture files.
3. Grader tests prove every requested metric, null denominator behavior, source
   range accuracy, unsupported evidence rejection, safe-fix validity, and agent
   routing/termination constraints.
4. CLI tests cover suite/agent/model/case/split selection, default split exclusion,
   report provenance, redaction, hardware profile validation, and baseline compare
   errors.
5. Regression tests cover each blocking threshold plus a rationale-authorized
   baseline update.
6. Dataset-governance tests ensure held-out cases cannot be selected by a
   development manifest and human-review output contains only aggregate labels.

Phase completion requires formatting, linting, type checking, build, deterministic
unit/integration/eval gates, security checks, documentation updates, and a new
interactive diff explanation. Live Ollama validation is optional and reported
separately; it is not part of the deterministic completion gate.

## Deferred Decisions

Phase 15 will consume these reports for exact/comparative fixture replay and model
comparison. Phase 16 will add synthetic-scale generation, retrieval-quality
evaluation, policy coverage, and wider public documentation.
