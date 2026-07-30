# Progress

## Current Phase

Phase 23 expanded reference repairs are active on a dedicated feature branch.
This parallel feature work does not alter the deferred Phase 19 manual
acceptance or Phases 21-22 release gates; those remain required before a
submission-ready claim.

## Completed Work

- Product interpretation, architecture, data model, interface, AI, security, reliability, testing, evaluation, context, and limitation documents created.
- Repository instructions, project skills, ADRs, phased implementation plan, evaluation workspace, and foundation review created.
- Phase 1 TypeScript tooling, CI, commands, public contracts, and guidance checks implemented.
- Phase 2 read-only vault scanner, reference-integrity checker, review UI, fixtures, deterministic evaluation, and end-to-end test implemented.
- Phase 3.1 Obsidian manifest, lifecycle entry point, settings validation, status view, command registration, and bundle build implemented.
- Phase 3.2 production Obsidian vault reader with normalized paths, SHA-256 revisions, cancellation, and event invalidation implemented.
- Phase 3.3 SQLite compatibility spike completed with the `sql.js` WebAssembly runtime, plugin-local database path, bundled WebAssembly asset, and ADR 0004.
- Phase 3.4 forward-only SQLite migrations and typed canonical repositories implemented, including fresh-install, upgrade, and failed-migration recovery tests.
- Phase 3.5 immutable scan snapshots, per-file revision inputs, lifecycle transitions, restart recovery, and completed-snapshot reuse implemented.
- Phase 3.6 canonical graph projection implemented for note, entity, project, task, decision, and attachment nodes with deterministic relationship edges.
- Phase 3.7 bounded YAML policy parser and versioned policy validation implemented with user-safe diagnostics.
- Phase 3.8 deterministic policy facts and evaluation implemented for project ownership, task due dates, decision rationale, archived-project tasks, and approved status values.
- Phase 3.9 deterministic frontmatter schema validation implemented with template selection and evidence locators.
- Phase 3.10 deterministic task parsing and integrity checks implemented for malformed, orphaned, duplicate, overdue, and abandoned tasks.
- Phase 3.11 decision indexing now preserves source evidence and detects unresolved rationale and supersession cycles.
- Phase 3.12 deterministic coordinator normalizes evidence-valid findings and persists the review queue without model calls.
- Phase 4.1 versioned, revision-bound proposal contracts implemented with fail-closed patch validation.
- Phase 4.2 deterministic, read-only broken-reference proposals implemented; unsupported findings remain non-applicable.
- Phase 4 review queue, diff preview, explicit approval actions, revision-safe apply, recovery-required state, and end-to-end safety tests implemented.
- Phase 5.1 local-only Ollama and llama.cpp provider abstraction implemented with loopback endpoint validation, timeout/cancellation, response limits, and capability selection.
- Phase 5.2 typed structured-output parsing, bounded repair/fallback, and redacted trace metadata implemented.
- Phase 5.3 bounded evidence-context assembly implemented with untrusted-data delimiters, limits, private-entry exclusion, and cache reuse.
- Phase 5 model-assisted agents implemented for entity aliases/duplicates, contradiction candidates, staleness candidates, and ambiguous decision candidates. All outputs are citation-validated against active scan evidence and assigned conservative deterministic handling.
- Deterministic coordinator routing, declared handoffs, per-agent termination, duplicate suppression, and versioned development/CI/held-out/adversarial/human-review datasets implemented.
- Desktop release packaging now produces a validated manifest, SHA-256 release record, and SQL WebAssembly asset. A temporary Obsidian-style install/uninstall smoke harness verifies the complete release layout.
- Governed scans now require a configured loopback-only local model provider and a completed semantic-analysis stage; provider absence and model-output exhaustion fail closed as incomplete scans.
- A fixed 300-file performance fixture now measures full-scan duration, incremental reparse duration, heap growth, and SQLite export size against versioned release thresholds.
- Failure injection now covers corrupt database bytes, migration rollback, vault I/O failure, provider timeout, malformed output, duplicate events, cancellation, and restart recovery.
- Bounded local diagnostics now retain only correlation IDs, generic codes, and safe messages; recovery runbooks cover migration, rebuild, provider, structured output, apply/re-index, and oversized-vault conditions.
- Versioned operational baselines and a metadata-only smoke report now gate scan duration, parse errors, local-model usage, incomplete work, findings, proposals, and apply outcomes.
- Offline/privacy acceptance checks now reject runtime shell, telemetry, cloud-storage, and non-loopback provider capabilities.
- The Obsidian status workspace now exposes a Run scan command that reads the vault, requires the local semantic-analysis stage, and populates the review queue with deterministic reference findings.
- Accessibility and interaction review completed with keyboard-native scan and filter controls, live scan/error announcements, readable `pre` diff content, narrow-pane-safe layout, and a safe absence of live destructive controls.
- The synthetic MVP acceptance vault now covers reference, task, schema, decision, policy, local-model coordinator, proposal, approval, apply, and post-write re-index paths.
- Correctness remediation: scan IDs are immutable, Markdown links resolve relative to their source note, proposal application groups same-file ranges from one preflight snapshot, read failures leave proposals `apply-failed`, and later write failures trigger compensating rollback of earlier writes.
- The live plugin now opens and migrates its local SQLite database, recovers interrupted scans at startup, persists completed governed scan snapshots and findings, and runs the configured one-shot scan-on-load action.
- Phase 7.1 unified finding contract implemented: supported deterministic and semantic finding families now share an evidence-validated, scan-scoped normalization boundary; ADR 0005 records the model-output trust boundary.
- Phase 7.2 governed scan pipeline implemented: frontmatter, deterministic task/schema/decision/policy checks, and bounded local-model candidates are derived from one immutable snapshot; a failed required model stage returns an incomplete result without completed findings.
- Phase 7 review workspace implemented: governed scans persist normalized findings and metadata-only model traces, the workspace reloads SQLite-backed findings, and deterministic reference repairs require an explicit review action and confirmation before revision-safe apply.
- Phase 8 adds versioned vault-event scan planning, revision-bound in-process parse reuse, persisted parse-product metadata and dependency records, exact-context local-model route reuse, conservative full-scan fallbacks, rename/delete impact analysis, and a local scan/finding lifecycle history view.
- Phase 11 adds a severity-led actionable dashboard, selected finding detail, repair controls limited to eligible broken references, preserved last-successful results after scan failure, a ribbon launcher, and packaged responsive styling.
- Phase 9 adds a fixed-path Policy Studio with deterministic draft validation and preview, explicit policy save and scan integration, evidence-bounded selected-finding explanations, local-model readiness checks, metadata-only reviewer feedback, and deterministic model-quality reports.
- Phase 12 adds metadata-only trace contracts, persisted scan spans and finding lineage, invalid-lineage rejection before review, and retention/deletion inventory controls.
- Phase 13 adds a collapsed metadata-only observability inspector with scan timelines, complete finding-lineage hops, deterministic configuration fingerprints, local privacy/retention controls, automatic retention cleanup, stored-data inventory, and operational scan metrics.
- Phase 14 adds versioned fixture vaults and manifests across all supported finding families, deterministic source/evidence graders, redacted configuration-rich reports, CI regression gates, protected held-out/adversarial/human-review splits, and local human-review agreement summaries.
- Phase 15 adds metadata-only live replay eligibility, deterministic fixture replay records, redacted single-variable comparison diffs, descriptive local model-comparison summaries, and confidence-calibration reports based only on adjudicated human labels.
- Phase 16 adds seeded synthetic-ground-truth generation, deterministic reference scale coverage, optional retrieval-quality metrics, aggregate policy coverage, and public documentation checked against repository claims.
- Phase 20 extends the local trace inspector with parented scanner through apply
  spans, redacted structured JSON export, snapshot-safe diagnostics, and an
  evidence-chain explorer. It binds immutable per-agent prompt registry hashes to
  scan configurations; surfaces local agent/evaluation unavailable states, health
  trends, fixture-only replay guidance, and guarded debug metadata; adds a
  deterministic release-quality report and regression-report artifacts; and
  documents reproducible synthetic benchmark methodology. None of these tools
  upload vault data or authorize edits.

## Current Work

Phase 23.1 now extends deterministic reference proposals to internal Markdown
links and wiki embeds while preserving labels and anchors. It emits
source-relative encoded Markdown destinations and resolves them after
re-indexing. Broken-anchor and rename-impact repair work remains pending in
this phase. The deferred Phase 19 manual desktop matrix and Phases 21-22
release evidence remain required before any submission-ready claim.

- Security hardening on 2026-07-20 rejects local-provider redirects, bounds provider configuration and response reads, binds approval/apply to validated persisted proposal digests, and enforces vault-reader/scanner resource and canonical-path limits.
- Phase 17 adds an explicit OpenAI provider option beside the default loopback Ollama/llama.cpp providers. OpenAI requests use a fixed API origin, bounded JSON-mode Responses API calls with `store: false`, a local API key, and a required cloud-data acknowledgement; keys remain excluded from traces, fingerprints, diagnostics, and portable exports.
- Phase 18 migrates the OpenAI adapter to the current Responses API request and response contract: `input`, `instructions`, JSON mode under `text.format`, `max_output_tokens`, `store: false`, and aggregate `output_text` parsing.
- The approved Phase 19 revision replaces the dashboard with
  `ready -> scanning -> recommendation -> applying -> result`, exact
  Current/After previews, deterministic expected outcomes, bounded AI target
  selection, all-member batch preflight, direct Settings and History, and a
  separate Diagnostics surface. The
  one-click Apply action records individual approvals, checks every proposal
  before the first write, re-indexes after success, and reports the actual
  result.
- Marketplace evidence now uses one versioned Northstar product/project
  workflow with 26 reviewed positive, hard-negative, and abstention cases.
  Provider-neutral contracts, redacted Ollama/OpenAI reports, unsafe-remediation
  rejection, and a combined same-fingerprint gate are implemented. The release
  runner now executes the real governed scan and bounded repair recommender
  instead of asking a model to classify deterministic findings. `gemma3:12b`
  passes the Ollama report; the OpenAI report remains pending.

## Important Decisions

- Obsidian plugin with local TypeScript core.
- SQLite is canonical; LanceDB is optional and derived.
- `sql.js` is the initial desktop-compatible SQLite runtime; its WebAssembly asset ships with the plugin bundle.
- Deterministic controls own parsing, policy, validation, approval, and apply.

## Risks

- The result-first flow has automated coverage, but it has not yet completed the
  required Obsidian desktop, narrow-pane, light/dark theme, keyboard, VoiceOver,
  Ollama, and OpenAI manual acceptance matrix. The code may advance
  `development` for Phase 20 work, but it remains unsuitable for release until
  that evidence is recorded.
- Agent quality thresholds are initial calibration targets and need representative local-vault review before a broader release.
- The marketplace corpus harness and live Ollama report are passing, but they do
  not substitute for the pending OpenAI execution or manual Obsidian
  acceptance.

## Verification Status

The Phase 14 completion gate passed on 2026-07-16: formatting, linting, type checking, build, packaged install smoke, 126 unit/component tests, 20 integration tests, 3 end-to-end tests, 3 acceptance tests, deterministic smoke/full evaluations, fixture-baseline evaluation, and a production dependency audit with no moderate-or-higher vulnerabilities. The Phase 15 completion gate passed on 2026-07-18: formatting, linting, type checking, build, packaged install smoke, 126 unit/component tests, 20 integration tests, 3 end-to-end tests, 3 acceptance tests, 36 replay/evaluation tests, deterministic smoke/full evaluations, fixture-baseline evaluation, and a production dependency audit with no moderate-or-higher vulnerabilities. The Phase 16 completion gate passed on 2026-07-18: formatting, linting, type checking, build, packaged install smoke, 128 unit/component tests, 20 integration tests, 3 end-to-end tests, 3 acceptance tests, 48 evaluation/replay/quality tests, deterministic smoke/full evaluations, generated synthetic baseline evaluation, retrieval report, fixture-baseline evaluation, performance and operational smoke reports, and a production dependency audit with no moderate-or-higher vulnerabilities. The revised Phase 19 automated gate passed again on 2026-07-29 after the governed release-evaluator correction: formatting, linting, type checking, build, packaged install smoke, 224 unit/component tests, 25 integration tests, 3 end-to-end tests, 3 acceptance tests, deterministic smoke/full evaluations, a passing 26-case `gemma3:12b` Ollama release report, and a production dependency audit with no vulnerabilities. The Phase 20 completion gate passed on 2026-07-29: formatting, linting, type checking, build, 236 unit/component tests, 25 integration tests, 3 end-to-end tests, 3 acceptance tests, smoke/full evaluation, dependency audit, and package-install smoke.

## Next Recommended Task

Complete the deferred Phase 19 manual desktop matrix and acknowledged OpenAI
provider report before any release candidate or marketplace submission. Phase
20 development may proceed in parallel.
