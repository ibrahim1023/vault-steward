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
| bounded repair recommendation  | contract, adversarial, provider doubles  | reference/task/decision/abstention | PR         |
| contextual normalization       | unit, integration, negative fixtures     | rename/canonical/ambiguity cases   | PR         |
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

Phase 23 extends this gate with exact-path, unique-basename, and unique-alias
resolution; heading and block parsing; code-block and malformed-ID exclusion;
20-candidate limits; duplicate normalized-anchor rejection; heading/block
selection and abstention; all four internal link/embed forms; encoded and
parent-relative Markdown destinations; explicit rename/canonical normalization
contexts; and absence of cleanup findings in ordinary scans. Apply coverage
continues to own digest integrity, stale rejection, overlap detection,
same-note grouping, all-member preflight, rollback, recovery-required state, no
unapproved write, and post-apply re-index verification. Component tests cover
compact Current → After rows, expandable metadata, provenance and target
labels, deterministic outcomes, progress/errors, keyboard interaction, and
narrow/light/dark rendering constraints.

Phase 24 extends it with metadata-confirmed completion only, due dates bounded
to the task/project/direct-decision context, active-snapshot owner/project/ADR
candidates, deterministic duplicate-ID suffixes, broken decision association
repair, and cited constrained decision rationale. Tests reject malformed
tasks/frontmatter, unknown candidates, invalid dates, hallucinated links,
uncited or injected drafts, stale sources, altered digests, overlaps, provider
failure, abstention, and every unapproved mutation. Mixed task/decision/
reference batches retain the same all-member preflight, rollback, and
post-apply re-index assertions.

Phase 25 extends it with a snapshot-bound side-by-side duplicate review,
two-note-only canonical ranking or abstention, and deterministic consolidation.
Fixtures cover hard negatives, unknown candidates, stale snapshots, duplicate
aliases, and conflicting metadata. Consolidation tests prove that only resolved
inbound wiki/Markdown links and embeds are rewritten, visible labels and
anchors survive, aliases transfer only when exclusively owned, and neither note
body is merged, deleted, or implicitly changed. Evaluation reports measure
canonical-selection precision, recall, abstention quality, evidence validity,
incorrect-canonical rate, and safe-repair validity.

## Marketplace Release Corpus

`evals/release/northstar-v1.json` is the versioned product/project-management
release corpus. It uses the realistic desktop acceptance vault and contains 26
hand-labelled positive, hard-negative, and abstention cases. Every case records
source ranges, expected finding type, severity, evidence IDs, and repair
eligibility. The loader rejects duplicate IDs, invalid paths, missing source
ranges, unbounded cases, and unknown evidence or candidate IDs.

Run the corpus separately through each provider:

```bash
OLLAMA_MODEL=<model> npm run eval:marketplace:ollama
HYPERFUSION_MODEL=qwen/qwen3-32b HYPERFUSION_API_KEY=<key> HYPERFUSION_CLOUD_ACKNOWLEDGED=true npm run eval:marketplace:hyperfusion
OPENAI_MODEL=<model> OPENAI_API_KEY=<key> OPENAI_CLOUD_ACKNOWLEDGED=true npm run eval:marketplace:openai
npm run eval:marketplace:gate
```

The marketplace gate requires the Ollama report to use the expected corpus
fingerprint and pass. HyperFusion and OpenAI reports are independent cloud
validation evidence; neither is marketplace-supported until its own corpus and
manual checks pass. Every report must pass
precision, recall, F1, evidence-validity, unsupported-finding,
safe-repair-validity, incomplete-scan, and unsafe-remediation thresholds. A
provider failure, malformed structured output, stale report, or unsafe
remediation blocks that provider's validation. Threshold changes require a
dated review rationale in the release quality report.

## Planned CI Stages

1. formatting, lint, and types
2. unit, schema/contract, fixture, and acceptance tests, plus coverage measurement
3. integration and migration tests
4. deterministic smoke and full evaluation checks
5. package/install smoke and security/dependency checks
6. build verification

Live marketplace-provider evaluations remain protected release checks because
they require an explicitly configured provider and acknowledgement; CI never
stores provider credentials.

Long model-dependent evals, performance/load checks, adversarial suites, and
provider corpus runs execute locally or on a protected release runner.
Snapshot tests are restricted to stable structured output, never free-form
model text.

## Policy Templates

Policy-template coverage includes registry and YAML validation, explicit-kind precedence, folder/heading classification, ambiguity and unrelated-note abstention, activated-template schema findings, draft-only rule creation, malformed intents, snapshot-derived candidate validation, proposal integrity, and exact-preview application. Tests must prove that a missing template field remains review-only when zero or multiple candidate values exist.
