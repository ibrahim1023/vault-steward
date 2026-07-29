# Testing Strategy

## Boundary Between Tests and Evals

Tests prove deterministic contracts: parsing, normalization, graph rules, policy evaluation, schema validation, path/permission checks, state transitions, retries, budgets, output parsing, and patch application. Evals measure probabilistic quality: duplicate detection, contradiction/staleness judgments, ranking, explanation usefulness, and model recovery behavior.

## Layers and Ownership

| Component                      | Required checks                          | Fixtures                           | Cadence    |
| ------------------------------ | ---------------------------------------- | ---------------------------------- | ---------- |
| parser/graph/policy            | unit, property, schema                   | Markdown/YAML edge cases           | commit     |
| SQLite repositories/migrations | integration, migration, replay           | populated temp database            | PR         |
| vault adapter/apply            | contract, integration, failure injection | fake Obsidian vault                | PR         |
| coordinator/agent boundary     | contract, state-machine, tool permission | malformed model/tool traces        | PR         |
| prepared repair batches        | contract, integration, failure injection | multi-proposal and stale batches   | PR         |
| bounded repair recommendation  | contract, adversarial, provider doubles  | rename/alias/abstention cases      | PR         |
| UI review flow                 | component and end-to-end                 | recommendation/apply/result states | PR         |
| model quality                  | smoke/full eval                          | golden/adversarial vault fixtures  | CI/nightly |
| release provider quality       | labelled corpus and regression gate      | Northstar release corpus           | release    |

## Fixture Policy

Use small synthetic vaults with stable IDs. Maintain fixtures for valid and malformed Markdown, invalid YAML, duplicate paths, renamed files, broken anchors, large notes, parser failures, malformed model JSON, timeouts, tool failures, prompt injection, duplicate and overflowed events, partial scans, parse-reuse version mismatches, exact-context model-cache hits and invalidations, resolved/stale/recurrent findings, stale proposals, same-note batch edits, overlapping operations, rollback, and discovered regressions. Keep tests hermetic; model-provider calls are opt-in outside deterministic suites.

## Simple Review Gate

The primary UI must prove one dominant action per state, an exact
**Current**/**After** preview, an accurate deterministic **Expected result**,
one-click explicit batch approval, an actual post-index result, a useful
non-repairable action, direct **Settings** and **History**, and a separate
**Diagnostics** surface. Contract tests cover
batch uniqueness, same-scan binding, metadata-only serialization, digest
integrity, all-member preflight, stale-member abort, and no unapproved write.
Recommendation tests cover verified renames, aliases, provider selection,
abstention, unknown targets, malformed output, prompt injection, and provider
failure.

## Marketplace Release Corpus

`evals/release/northstar-v1.json` is the versioned product/project-management
release corpus. It uses the realistic desktop acceptance vault and contains 23
hand-labelled positive, hard-negative, and abstention cases. Every case records
source ranges, expected finding type, severity, evidence IDs, and repair
eligibility. The loader rejects duplicate IDs, invalid paths, missing source
ranges, unbounded cases, and unknown evidence or candidate IDs.

Run the corpus separately through each provider:

```bash
OLLAMA_MODEL=<model> npm run eval:marketplace:ollama
OPENAI_MODEL=<model> OPENAI_API_KEY=<key> OPENAI_CLOUD_ACKNOWLEDGED=true npm run eval:marketplace:openai
npm run eval:marketplace:gate
```

The gate requires both reports to use the same corpus fingerprint and pass
precision, recall, F1, evidence-validity, unsupported-finding,
safe-repair-validity, incomplete-scan, and unsafe-remediation thresholds. A
provider failure, malformed structured output, stale report, missing report, or
unsafe remediation blocks the release. Threshold changes require a dated
review rationale in the release quality report.

## Planned CI Stages

1. formatting, lint, types
2. unit and schema/contract tests
3. integration and migration tests
4. deterministic eval smoke checks
5. security/dependency checks
6. build verification

Long model-dependent evals, performance/load checks, adversarial suites, and the
two-provider release corpus run locally or on a protected release runner.
Snapshot tests are restricted to stable structured output, never free-form
model text.
