# Progress

## Current Phase

Release `0.2.1` is tagged, published through the attested GitHub Actions
release workflow, and available through Obsidian Community Plugins. The `0.3.0`
maintenance foundation is approved scope recorded in the
[maintenance roadmap](superpowers/specs/2026-09-14-maintenance-foundation-roadmap.md)
and is now in implementation. Its two foundational decisions,
[ADR 0008](decisions/0008-stable-finding-identity-and-occurrences.md) (stable
finding identity and occurrences) and
[ADR 0009](decisions/0009-integrity-event-store-and-retention.md) (append-only
integrity events and retention), were accepted on 2026-09-28; their storage
foundations are implemented while runtime wiring remains pending. The bounded
[0.3.0 implementation plan](superpowers/plans/2026-09-28-maintenance-foundation.md)
was approved on 2026-09-28. On `feat/phase-33-identity-events`, Phase 33 Task 1
delivered the finding identity/occurrence and integrity-event contracts,
Task 2 delivered migration 12 with the maintenance repositories, integrity
retention, and legacy `v0` backfill, and Task 3 delivered the family identity
adapters, the v2 promotion boundary, ephemeral scanned-note subjects, and
v2 coordinator persistence/hydration. The phase completion gate has not run and
the branch is not promoted; durable subject persistence and remaining runtime
wiring remain future tasks.

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

Release-owner preparation is complete. The `0.2.1` release and its Community
Plugins publication are complete: the repository, MIT license, version, tag,
changelog, package, screenshots, manual evidence, attested release assets, and
final go decision are aligned. The stable finding identity/occurrence ADR
(0008) and the append-only integrity-event/retention ADR (0009) were accepted
for `0.3.0` planning on 2026-09-28; their storage foundations are now
implemented and runtime wiring remains pending. The bounded `0.3.0`
implementation plan was approved on 2026-09-28. Phase 33 Tasks 1–3 are
implemented on `feat/phase-33-identity-events`; later phase tasks, the phase
gate, and promotion are still open.

Completed: Phase 33 Task 1 added validated finding identity/occurrence and
append-only integrity-event contracts, and Task 2 added migration 12, note
subjects, identity/occurrence persistence, dispositions, event append/read with
exact-duplicate idempotency, retention settings/prune/purge with a deletion
ledger, migration-ordering validation, and the legacy `v0` occurrence backfill
wired into database open.

Completed: Phase 33 Task 3 added per-family identity adapters in
`src/findings/identity.ts`, the v2 `normalizeFinding` promotion boundary
(revalidated canonical identity, promoted evidence with role/subject/locator/
revision, excerpt-free `evidenceRevisionKey`, deterministic occurrence), an
ephemeral opaque `ScannedNote.subjectId` surviving in-memory revision reuse,
coordinator deduplication keyed by `occurrenceId` with exact-duplicate
rejection, v2 identity/finding/occurrence persistence, and `hydrateFinding`
v2 hydration with legacy v1 fallback. All active producers — reference
integrity and normalization, tasks, schema/templates, decisions, policy,
semantic candidates, and change-aware maintenance — now emit schema v2
findings.

Completed: Phase 33 Task 4 replaced ephemeral scan subjects with
repository-backed opaque note subjects. `processVaultEvents` binds/retires/
renames subjects per event and flushes before the scan consumes the batch;
only an observed unambiguous rename to a safe unused path preserves the
subject, while a failed flush restores the in-memory database from
pre-mutation bytes and flags `subject-persistence-failed` (forcing a full
plan). `synchronizeNoteSubjects` reconciles listed paths each scan and aborts
on failure so v2 findings never carry unpersisted identity. File revisions now
hash content only, so a path-only rename keeps `evidenceRevisionKey`.

Implemented: Phase 33 Task 5 added completed-scan comparison and
transactional integrity events. `compareFindingOccurrences` classifies
`unchanged`/`changed`/`resolved`/`recurring`/`new` between the current scan
and completed scans sharing an identical non-legacy `identity_profile_hash`;
historical scans are validated per scan so an unchanged finding spanning
multiple baselines is not contradictory. `saveCompletedScan` commits snapshot
plus `scan-started`, then all domain persistence, review events, and
`scan-completed` in one transaction, with failure truthfully recorded as
`failed` plus `scan-failed`. Interrupted `running` scans record `scan-failed`
at the next open, and `ReviewWorkflow` appends one audit event per canonical
transition atomically with each status/approval change; interrupted applies
recover to `recovery-required` at plugin startup. Proposal persistence
composes with `proposal-prepared` audit events, and a 10,000-event fixture
enforces an 8 MiB SQLite budget as a performance gate, not a retention cap.

Completed: Phase 32 prepared the `0.2.1` release for the Community Directory
reviewer. It uses Preact compatibility rendering rather than a bundled React DOM
runtime, registers settings through Obsidian's declarative settings API, and
publishes attested release assets through GitHub Actions. The required `main`
manifest entry and bounded vault enumeration remain intentional product
capabilities.

Completed: Phase 25's snapshot-bound duplicate-entity review remains
implemented: it shows only the two cited notes and bounded evidence, requires
the user to select a canonical note, and prepares only previewed link and alias
changes. Its earlier manual-acceptance deferral is historical; the
current macOS manual acceptance matrix and Phase 30 release evidence are
recorded below as complete.

Completed release evidence retained from earlier phases:

- Security hardening on 2026-07-20 rejects local-provider redirects, bounds provider configuration and response reads, binds approval/apply to validated persisted proposal digests, and enforces vault-reader/scanner resource and canonical-path limits.
- Phase 17 adds an explicit OpenAI provider option beside the default loopback Ollama/llama.cpp providers. OpenAI requests use a fixed API origin, bounded JSON-mode Responses API calls with `store: false`, a local API key, and a required cloud-data acknowledgement; keys remain excluded from traces, fingerprints, diagnostics, and portable exports.
- Phase 18 migrates the OpenAI adapter to the current Responses API request and response contract: `input`, `instructions`, JSON mode under `text.format`, `max_output_tokens`, `store: false`, and `output_text` parsing from response messages.
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
  instead of asking a model to classify deterministic findings. `qwen3:8b` and
  `gpt-4o-mini` each pass their recorded Northstar reports; both cloud providers
  remain experimental opt-in paths.

## Important Decisions

- Phase 26 adds local-only, evidence-backed maintenance signals for rename/delete impact and newly superseded decisions. Safe modify event batches record an incremental reuse plan; all ambiguous events retain conservative full-vault behavior. The maintenance queue provides review actions only and never writes notes.
- Phase 27 adds guided policy templates and deterministic, abstaining classification. A known template field can become a prepared repair only when the active snapshot contains exactly one safe existing candidate value; it remains exact-preview and approval gated.
- Phase 28 adds individually selectable, deterministically grouped repair previews with
  aggregate outcomes. The selected subset still uses the existing all-member digest,
  revision, conflict, rollback, and re-index protections. Dismissal reasons and
  repeated false-positive patterns remain local; only three matching reports expose a
  user-reviewed suppression control in Diagnostics. Suppression changes primary-review
  presentation only, never scanning, evidence validation, policy execution, or writes.
- On 2026-08-04, the approved minimal-Diagnostics design removes Policy Studio,
  manual impact inspection, observability details, prompt registry, evaluation/replay
  screens, and the debug console from the v0.1 workspace. The remaining four user
  controls are model connection, automatic checks, reviewed local suppression, and
  confirmed local trace deletion. Policy, maintenance, observability, evaluation, and
  trace-storage systems remain internal safeguards and release tooling.
- Phase 29 corrects the raw Responses API adapter to read only `output_text` message
  content from the documented response `output` array and makes the synthetic readiness
  input explicitly JSON-mode compatible. It also omits unrelated heading/block anchors
  before model selection, so a model cannot propose a weak anchor substitution. This
  preserves the fixed-origin, JSON-only, no-tools, `store: false` OpenAI boundary; the
  live `gpt-4o-mini` Northstar report now passes with no unsafe remediation, and its
  manual Obsidian readiness check plus governed scan completed on 2026-08-05. Manual
  acknowledgement blocking and invalid-credential handling were also verified: no key
  text was exposed, and the connection recovered after the valid acknowledged key was
  restored.
- UI-07 now exposes a secondary `Check vault again` action from an open judgment,
  so a provider change can start a fresh governed scan without reopening the
  workspace or changing the current finding. Automated coverage and a manual
  OpenAI-to-HyperFusion retest passed on 2026-08-05.
- Phase 30 security hardening binds repair proposals to exact scanner line/column
  evidence and rejects legacy locators, revalidates content through Obsidian's
  per-file write processing, rejects oversized files before read, bounds policy
  and frontmatter YAML, separates OpenAI and HyperFusion acknowledgements, and
  replaces quadratic structured-JSON recovery with a linear bounded pass. The
  deferred `gray-matter` candidate was dynamically confirmed in the packaged
  runtime (`---js` executes `module.exports`), so that dependency was removed;
  frontmatter is now parsed only as bounded YAML. Automated regression coverage covers duplicate evidence, write
  boundary changes, pre-read size rejection, policy nesting/aliases, provider
  consent migration, and malformed structured output.
- Phase 30 completed on 2026-08-12 and was promoted to `development` at
  `bdd770f`. The final completion repair is deterministic: an unchecked task
  explicitly marked `status:done` prepares only the bounded `[ ]` to `[x]`
  change and no longer depends on model output. The full gate passed on the
  promoted commit: 402 tests with coverage, integration, end-to-end and
  acceptance suites, deterministic/full evaluations, package-install smoke,
  and a zero-vulnerability production dependency audit. The macOS acceptance
  retest also covered provider-specific consent, exact preview/stale safety,
  and the deterministic completion repair. The completed deep-security scan
  identified two low-severity findings. Both were remediated by fail-closed
  policy loading and conditional rollback, with regression coverage protecting
  both paths.
- The 2026-08-05 release audit corrected the complex-acceptance fixture count
  after two intentional stale-batch exercise notes were added. CI now runs the
  full Vitest coverage suite, acceptance tests, full deterministic evaluations,
  and the packaged-plugin install smoke. Live marketplace-provider reports stay
  protected release checks because they require an explicit cloud acknowledgement
  and credentials.
- The complete macOS manual acceptance matrix, including HyperFusion safety
  recovery, batch safeguards, accessibility, provider-specific acknowledgement,
  and deterministic completion repair, was signed off by the release tester on
  2026-08-12. Phase 30 is promoted; marketplace materials remain a separate
  release-submission task.
- Phase 27 regression coverage now includes folder-classified template repairs and empty
  frontmatter blocks, plus malformed or expanded repair-intent rejection. HyperFusion's
  deterministic boundary tests and redacted `qwen/qwen3-32b` Northstar corpus report pass.
  Its current macOS manual/provider acceptance is complete; HyperFusion remains an
  experimental, opt-in provider.

- Obsidian plugin with local TypeScript core.
- SQLite is canonical; LanceDB is optional and derived.
- `sql.js` is the initial desktop-compatible SQLite runtime; its WebAssembly asset ships with the plugin bundle.
- Deterministic controls own parsing, policy, validation, approval, and apply.

## Risks

- The current macOS manual acceptance matrix, including the supported provider
  paths, is complete. Windows and Linux remain unvalidated and must not be
  presented as supported until equivalent desktop evidence is recorded.
- Agent quality thresholds are initial calibration targets and need
  representative local-vault review before a broader release.
- Windows and Linux validation and optional promotional recording remain future
  work; neither is part of the current macOS Community Plugins submission gate.

## Verification Status

The Phase 14 completion gate passed on 2026-07-16: formatting, linting, type checking, build, packaged install smoke, 126 unit/component tests, 20 integration tests, 3 end-to-end tests, 3 acceptance tests, deterministic smoke/full evaluations, fixture-baseline evaluation, and a production dependency audit with no moderate-or-higher vulnerabilities. The Phase 15 completion gate passed on 2026-07-18: formatting, linting, type checking, build, packaged install smoke, 126 unit/component tests, 20 integration tests, 3 end-to-end tests, 3 acceptance tests, 36 replay/evaluation tests, deterministic smoke/full evaluations, fixture-baseline evaluation, and a production dependency audit with no moderate-or-higher vulnerabilities. The Phase 16 completion gate passed on 2026-07-18: formatting, linting, type checking, build, packaged install smoke, 128 unit/component tests, 20 integration tests, 3 end-to-end tests, 3 acceptance tests, 48 evaluation/replay/quality tests, deterministic smoke/full evaluations, generated synthetic baseline evaluation, retrieval report, fixture-baseline evaluation, performance and operational smoke reports, and a production dependency audit with no moderate-or-higher vulnerabilities. The revised Phase 19 automated gate passed again on 2026-07-29 after the governed release-evaluator correction: formatting, linting, type checking, build, packaged install smoke, 224 unit/component tests, 25 integration tests, 3 end-to-end tests, 3 acceptance tests, deterministic smoke/full evaluations, a passing 26-case `gemma3:12b` Ollama release report, and a production dependency audit with no vulnerabilities. The Phase 20 completion gate passed on 2026-07-29: formatting, linting, type checking, build, 236 unit/component tests, 25 integration tests, 3 end-to-end tests, 3 acceptance tests, smoke/full evaluation, dependency audit, and package-install smoke. The Phase 23 automated completion gate passed on 2026-07-30: formatting, linting, type checking, build, 263 unit/component tests, 25 integration tests, 3 end-to-end tests, 3 acceptance tests, deterministic smoke/full evaluations, a production dependency audit with no vulnerabilities, and package-install smoke. The Phase 24 automated completion gate passed on 2026-08-01: formatting, linting, type checking, build, 101 unit files with 290 tests, 25 integration tests, 3 end-to-end tests, 3 acceptance tests, deterministic smoke/full evaluations, a production dependency audit with no vulnerabilities, and package-install smoke. The Phase 25 automated completion gate passed on 2026-08-01: formatting, linting, type checking, build, 106 unit files with 305 tests, 25 integration tests, 3 end-to-end tests, 3 acceptance tests, deterministic smoke/full evaluations, a production dependency audit with no vulnerabilities, and package-install smoke. At that historical Phase 25 point, manual Obsidian acceptance remained open; the current macOS manual/provider acceptance is recorded above as complete.

## Next Recommended Task

Continue Phase 33 on `feat/phase-33-identity-events`: Task 5 passed review,
its fixes, and the phase completion gate; commit and then proceed to the next
task in `docs/superpowers/plans/2026-09-28-maintenance-foundation.md`.
