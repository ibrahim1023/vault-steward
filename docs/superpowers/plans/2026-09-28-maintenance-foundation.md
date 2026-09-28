# Maintenance Foundation 0.3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Approved on 2026-09-28 — runtime implementation has not started.

**Goal:** Turn the shipped scanner and review queue into dependable ongoing maintenance: stable finding identity, snapshot-bound occurrences, append-only integrity events, Changes Since Last Check, Steward Inbox dispositions, a basic Timeline, a fixed-origin opt-in Groq provider, SecretStorage key custody, Windows/Linux validation, and consented real-vault quality cases.

**Architecture:** Extend the existing sql.js-backed canonical store with additive identity, occurrence, subject, disposition, integrity-event, and retention tables; keep Obsidian APIs (including SecretStorage) at the plugin boundary; add the Groq provider behind the existing bounded provider abstraction. No existing authority moves: scanning, proposals, approvals, and apply stay canonical.

**Tech Stack:** TypeScript, sql.js (SQLite/WASM), Preact compatibility UI, Obsidian declarative settings and SecretStorage, Vitest, esbuild, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-maintenance-foundation-roadmap.md`

**Decisions:**
[ADR 0008](../../decisions/0008-stable-finding-identity-and-occurrences.md) (stable finding identity and occurrences) and
[ADR 0009](../../decisions/0009-integrity-event-store-and-retention.md) (append-only integrity events and retention), both accepted for planning on 2026-09-28.

Shipped behavior remains governed by `spec.md`. Owner approval is complete; implementation still requires the planning documentation to land and the Phase 33 branch to be created from an up-to-date `development`. No runtime changes have started.

## Global Constraints

- Preserve the local-first, evidence-first, explicit-approval, deterministic-write boundaries; no autonomous editing and no telemetry or remote vault storage.
- Models cannot define identity, events, dispositions, policy, patches, or authority; they may only classify, extract candidates, or rank evidence through typed contracts.
- Core modules must not import Obsidian APIs; SecretStorage access stays at the plugin boundary.
- No note bodies, excerpts, prompts, raw model output, API keys, or paths in integrity events; `safeMetadata` is allowlisted per ADR 0009.
- Forward-only migration only; preserve all finding/proposal/approval IDs and every proposal digest.
- Tests before behavior; run the narrowest relevant check first; each internal phase uses a dedicated `feat/phase-*` branch from `development` and is promoted only after its gate passes.
- Scheduled cloud inference is out of scope for 0.3.0; ordinary cloud consent cannot authorize it.
- Windows and Linux remain unsupported claims until manual matrices pass.
- Live provider and real-vault checks are protected owner actions, never ordinary CI.

## Internal phases

Each internal phase starts only after the prior phase gate is promoted to `development`.

- Phase 33 — Identity and events: `feat/phase-33-identity-events`
- Phase 34 — Maintenance workspace: `feat/phase-34-maintenance-workspace`
- Phase 35 — Groq and secrets: `feat/phase-35-groq-secrets`
- Phase 36 — Platform and release: `feat/phase-36-platform-release`

---

## Phase 33 — Identity and Events

Branch: `feat/phase-33-identity-events` from `development`.

### Task 1: Identity and integrity-event contracts with canonical validators

**Files:**

- Create: `src/contracts/finding-identity.ts`, `src/contracts/integrity-event.ts`
- Modify: `src/contracts/index.ts`
- Create: `tests/contracts/finding-identity.test.ts`, `tests/contracts/integrity-event.test.ts`

**Interfaces/schema:**

- `FindingIdentity` and `FindingOccurrence` exactly as defined in ADR 0008, plus the canonical stable-key input order, `finding:v1:` and `occurrence:v1:` prefixes, and SHA-256 canonical-encoding helpers.
- Finding schema v2 adds required `stableKey`, `occurrenceId`, and `evidenceRevisionKey`; legacy v1 findings remain read-only and non-comparable.
- `IntegrityEvent` and `IntegrityEventCategory` exactly as defined in ADR 0009 with the kind/category allowlists and field bounds: kind length 80, IDs 256, at most 32 metadata entries, metadata keys 64, string values 256, serialized metadata 4096 bytes, finite numbers only, flat `safeMetadata` only (no nested objects or arrays).
- Runtime parsers/validators for all of the above; invalid input returns a typed rejection, never a throw into the review path.

**Tests first:**

- [ ] Write failing tests for canonical stable-key ordering, hashing, and prefixes per ADR 0008.
- [ ] Write failing tests for occurrence-ID derivation and `evidenceRevisionKey` construction (sorted role-labelled subjects, no excerpts).
- [ ] Write failing tests for event category/kind allowlists, every field bound, finite numbers, and flat metadata rejection.
- [ ] Write failing tests that v1 findings hydrate read-only and are excluded from comparability.

**Implementation:**

- [ ] Implement the contracts, canonical encoder, and runtime validators.
- [ ] Export the new contracts from `src/contracts/index.ts`.

**Verify:** `npx vitest run tests/contracts/finding-identity.test.ts tests/contracts/integrity-event.test.ts && npm run typecheck`

**Docs:** none yet; contract surface lands behind the migration gate.

**Commit boundary:** `feat: add finding identity and integrity event contracts`

### Task 2: Migration 12 and maintenance repositories

**Files:**

- Modify: `src/storage/migrations.ts`, `src/storage/repositories.ts`, `src/storage/scan-snapshots.ts`
- Modify: `tests/integration/storage-migrations.test.ts`
- Create: `tests/integration/maintenance-storage.test.ts`

**Interfaces/schema:** migration 12 creates exactly:

```sql
ALTER TABLE scans ADD COLUMN identity_profile_hash TEXT NOT NULL DEFAULT 'legacy';
CREATE TABLE note_subjects(
  subject_id TEXT PRIMARY KEY,
  current_path TEXT UNIQUE,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE note_path_history(
  subject_id TEXT NOT NULL REFERENCES note_subjects(subject_id),
  path TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  retired_at TEXT,
  PRIMARY KEY(subject_id, path, observed_at)
);
CREATE TABLE finding_identities(
  stable_key TEXT PRIMARY KEY,
  identity_version INTEGER NOT NULL,
  family TEXT NOT NULL,
  subtype TEXT NOT NULL,
  detector_id TEXT NOT NULL,
  detector_version TEXT NOT NULL,
  policy_id TEXT,
  policy_version TEXT,
  subject_ids_json TEXT NOT NULL,
  semantic_key TEXT NOT NULL
);
CREATE TABLE finding_occurrences(
  occurrence_id TEXT PRIMARY KEY,
  stable_key TEXT NOT NULL REFERENCES finding_identities(stable_key),
  finding_id TEXT NOT NULL UNIQUE REFERENCES findings(id),
  scan_id TEXT NOT NULL REFERENCES scans(id),
  evidence_revision_key TEXT NOT NULL,
  identity_version INTEGER NOT NULL,
  UNIQUE(stable_key, scan_id, evidence_revision_key)
);
CREATE TABLE review_dispositions(
  id TEXT PRIMARY KEY,
  stable_key TEXT NOT NULL,
  source_occurrence_id TEXT NOT NULL,
  source_evidence_revision_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('acknowledged','ignored','snoozed','expected','restored')),
  reason TEXT,
  created_at TEXT NOT NULL,
  until_at TEXT,
  until_evidence_changes INTEGER NOT NULL CHECK(until_evidence_changes IN (0,1)),
  restores_disposition_id TEXT
);
CREATE TABLE integrity_events(
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('audit','review','operational')),
  kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  scan_id TEXT,
  stable_key TEXT,
  occurrence_id TEXT,
  proposal_id TEXT,
  approval_id TEXT,
  safe_metadata_json TEXT NOT NULL
);
CREATE TABLE integrity_retention_settings(
  id INTEGER PRIMARY KEY CHECK(id = 1),
  operational_days INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE retention_deletions(
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  category TEXT NOT NULL,
  reason TEXT NOT NULL,
  deleted_count INTEGER NOT NULL,
  range_start TEXT,
  range_end TEXT
);
```

- Seed `integrity_retention_settings` with `operational_days = 180`.
- Event reference ID columns intentionally carry no foreign keys; the append transaction validates canonical references, and protected minimal occurrence/identity rows remain when larger projections are pruned.
- Indexes: occurrence by scan and stable key, events by category/time and entity IDs, dispositions by stable key and time, path-history active lookup.
- Repository APIs: `withTransaction`, subject bind/rename/delete, identity/occurrence save/list, append event with exact-field idempotency, disposition append and effective-state query, retention settings read/write, prune/purge, deletion-ledger append.
- Legacy backfill runs as a repository step after the SQL migration: each existing finding gets an isolated `identityVersion: 0` key and occurrence; rows are never merged across scans; proposal digests are unchanged. The step is idempotent and invoked transactionally from database open.

**Tests first:**

- [ ] Write failing migration tests for fresh install, upgrade, failed-migration recovery, and forward-only ordering.
- [ ] Write failing tests for every repository API, exact-duplicate idempotent event append, and fail-closed mismatched duplicate.
- [ ] Write failing tests for legacy backfill: isolated v0 occurrences, no cross-scan merge, unchanged proposal/approval digests, and idempotent re-open.

**Implementation:**

- [ ] Add migration 12, indexes, and the seeded retention settings row.
- [ ] Implement the repository APIs and transactional backfill.

**Verify:** `npx vitest run tests/integration/storage-migrations.test.ts tests/integration/maintenance-storage.test.ts tests/storage/trace-retention.test.ts && npm run typecheck`

**Docs:** `docs/interfaces.md`, `docs/architecture.md` data-model section.

**Commit boundary:** `feat: add maintenance storage migration and repositories`

### Task 3: Identity adapters for every current finding family

**Files:**

- Create: `src/findings/identity.ts`
- Modify: `src/findings/normalize.ts` and all finding producers under reference normalization/check, governed-scan task/schema/decision/policy/semantic paths, `src/maintenance/change-aware.ts`, and coordinator deduplication
- Create: `tests/findings/identity.test.ts`
- Modify: affected tests under `tests/findings`, `tests/core`, `tests/reference`, `tests/maintenance`, `tests/tasks`, `tests/schema`, `tests/decisions`, `tests/policy`, `tests/model-provider`, `tests/agents`

**Interfaces/schema:** one bounded adapter per family/subtype supplying validated canonical identity parts:

- Reference integrity: broken/invalid/reference-normalization subtypes with normalized target.
- Tasks: task issue kind plus deterministic task ID, with versioned structural locator fallback.
- Schema: template/field/rule.
- Decisions: decision issue kind plus decision ID.
- Policy: policy ID/version/rule.
- Entity alias: unordered subject pair.
- Contradiction: role-labelled pair; canonical unordered only when detector semantics are symmetric.
- Semantic staleness: subject plus staleness rule.
- Maintenance: rename/delete/superseded-decision subtypes.

The generic normalizer requires validated identity input and cannot derive identity from prose or excerpts; direct constructors must route through the promotion boundary or a validated deterministic adapter. `evidenceRevisionKey` uses subject ID, role, normalized locator, and file revision — never excerpts. Exact duplicate occurrences fail closed. Active scans emit finding v2; v1 exists only for legacy hydration and history.

**Tests first:**

- [ ] Write a failing identity test per family adapter, including unordered-set sorting and ordered role-labelled pairs.
- [ ] Write failing tests that normalization rejects missing or unvalidated identity parts.
- [ ] Write failing duplicate-occurrence rejection tests.

**Implementation:**

- [ ] Implement `src/findings/identity.ts` and wire every producer through its adapter.
- [ ] Route all finding construction through the promotion boundary.

**Verify:** `npx vitest run tests/findings tests/core tests/reference tests/maintenance tests/tasks tests/schema tests/decisions tests/policy tests/model-provider tests/agents && npm run typecheck`

**Docs:** `docs/interfaces.md` finding contract, `docs/ai-system.md` model boundary note.

**Commit boundary:** `feat: derive stable finding identity per family`

### Task 4: Persisted note subjects and rename handling

**Files:**

- Modify: `src/contracts/incremental.ts`, `src/vault-adapter/obsidian-reader.ts`, `src/plugin/database.ts`, `src/main.ts`, `src/indexing/plan.ts`
- Modify: `tests/vault-adapter`, `tests/indexing`, `tests/integration`

**Interfaces/schema:**

- The Obsidian rename callback transactionally retires the old active
  path-history row, updates `note_subjects.current_path`, appends the new
  path-history row, and flushes the plugin database before the next scan can
  consume the event. If persistence fails, do not claim rename continuity:
  queue a conservative full scan and let the new path receive a new subject.
  Exactly one active old subject plus a safe unused new normalized path
  preserves the subject UUID.
- Modify on the same path retains the subject; create assigns a UUID; delete retires the path binding without reusing the subject ID; path reuse creates a new UUID.
- Unobserved, offline, or ambiguous rename never content-matches and always creates a new subject.
- Pure rename evidence-revision rule: when content revision and normalized structural locator are unchanged, a path rename alone does not change `evidenceRevisionKey` and does not wake a snooze.

**Tests first:**

- [ ] Write failing tests for create, modify, observed rename, unobserved/offline/ambiguous rename, delete, and path-reuse subject behavior.
- [ ] Write a failing rename-persistence-failure test: a failed flush produces a conservative full scan and a new subject on the new path.
- [ ] Write the failing pure-rename evidence-revision test explicitly (do not assume whole-file revision behavior).
- [ ] Write failing restart-persistence tests for subject and path-history state.

**Implementation:**

- [ ] Implement subject persistence and rename/delete handling in the vault event path.

**Verify:** `npx vitest run tests/vault-adapter tests/indexing tests/integration && npm run typecheck`

**Docs:** `docs/architecture.md` subject/rename section, `docs/reliability.md` recovery notes.

**Commit boundary:** `feat: persist note subjects across observed renames`

### Task 5: Scan comparison, transitions, and transactional events

**Files:**

- Create: `src/findings/compare.ts`
- Modify: `src/plugin/database.ts`, `src/storage/scan-snapshots.ts`, `src/storage/repositories.ts`, `src/coordinator/normalize.ts`
- Create: `tests/findings/compare.test.ts`
- Modify: `tests/integration/finding-lifecycle.test.ts`, failure-injection tests

**Interfaces/schema:**

- Populate the `identity_profile_hash` column added to `scans` by migration 12 (Task 2); the profile canonicalizes identity version plus sorted detector IDs/versions. Comparison runs only between completed scans with equal non-legacy profiles; the first v1 scan is baseline only.
- Transition semantics exactly per ADR 0008: unchanged, changed, resolved, recurring, new.
- Review events (`opened`, `changed`, `recurred`, `resolved`) append transactionally with completed-scan persistence; incomplete/failed/canceled scans never resolve. Operational scan events are typed.
- Proposal/review audit events append in the same DB transaction as the domain transition where possible; filesystem apply remains staged — `apply-started` before the write, `applied` only after the canonical state update succeeds, rollback/recovery outcomes recorded truthfully. Success is never inferred from events.
- Add a database-size performance fixture for the ADR 0009 budget; no global event cap.

**Tests first:**

- [ ] Write failing comparison tests for every transition, completed-only comparability, baseline-only first v1 scan, and restart persistence.
- [ ] Write failing tests that incomplete scans produce no resolved transitions.
- [ ] Write failing transactional event tests: domain transition plus event commit or roll back together.
- [ ] Write failing DB-size budget fixture assertions.

**Implementation:**

- [ ] Implement `src/findings/compare.ts` and wire comparison plus event append into scan completion and the review workflow.

**Verify:** `npx vitest run tests/findings tests/integration tests/resilience tests/storage && npm run typecheck`

**Docs:** `docs/architecture.md`, `docs/interfaces.md`, `docs/security.md`, `docs/reliability.md`, `docs/testing-strategy.md`, `docs/progress.md`; set ADR 0008/0009 status to Implemented only after the phase gate.

**Phase 33 gate:** `npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:acceptance && npm run perf:smoke && npm run ops:smoke && npm run security:check && npm run test:plugin-install`; then promote `feat/phase-33-identity-events` to `development`.

**Commit boundary:** `feat: compare completed scans and append integrity events`

---

## Phase 34 — Maintenance Workspace

Branch: `feat/phase-34-maintenance-workspace` from `development` after the Phase 33 gate is promoted.

### Task 6: Changes service and view

**Files:**

- Create: `src/maintenance/changes.ts`, `src/ui/ChangesView.tsx`
- Modify: workspace/plugin wiring and styles
- Create: `tests/maintenance/changes.test.ts`, `tests/ui/changes-view.test.tsx`

**Interfaces/schema:** `ChangesSummary` carries baseline and current scan IDs plus lists for new, changed, recurring, resolved, and unchanged findings; excludes legacy, incompatible, and incomplete comparisons; user baseline selection among retained compatible completed scans; no historic note-body reconstruction.

**Tests first:**

- [ ] Write failing service tests for summary construction, baseline selection, and exclusion rules.
- [ ] Write failing view tests for rendering and empty/legacy states.

**Implementation:**

- [ ] Implement the service and view; wire into the workspace.

**Verify:** `npx vitest run tests/maintenance tests/ui tests/integration && npm run typecheck`

**Docs:** `docs/architecture.md` workspace section.

**Commit boundary:** `feat: add changes since last check`

### Task 7: Steward Inbox dispositions

**Files:**

- Create: `src/review/dispositions.ts`, `src/ui/StewardInbox.tsx`
- Modify: dashboard, workspace, `src/main.ts` wiring
- Create/modify: tests under `tests/review`, `tests/ui`, `tests/integration`

**Interfaces/schema:** query latest completed occurrences plus effective disposition; `acknowledged`, `ignored`, and `expected` apply only to the current evidence revision; `snoozed` ends at its date or on evidence change; `restored` is a reversal event; critical count remains visible; filters supported; repairable findings use `Review fix`; no Inbox action writes to the vault. Bulk actions are individually selected with exact counts. Existing pattern suppression stays separate.

**Tests first:**

- [ ] Write failing disposition tests for set/restore, revision-bound expiry, snooze wake on evidence change, and critical-count visibility.
- [ ] Write failing tests proving no Inbox action performs a vault write.
- [ ] Write failing UI tests for `Review fix` labeling, filters, and bulk-selection counts.

**Implementation:**

- [ ] Implement the disposition service and Inbox view; wire into the workspace.

**Verify:** `npx vitest run tests/review tests/ui tests/integration && npm run typecheck`

**Docs:** `docs/architecture.md`, `docs/interfaces.md` disposition contract.

**Commit boundary:** `feat: add steward inbox dispositions`

### Task 8: Integrity Timeline and workspace integration

**Files:**

- Create: `src/ui/IntegrityTimeline.tsx`, optional `src/maintenance/timeline.ts`
- Modify: History/workspace/portability only as needed
- Create/modify: UI, integration, and export tests

**Interfaces/schema:** four destinations — Health (existing status/count summary only, no 0-100 score in 0.3.0), Inbox, Changes, Timeline. Integrate the existing selected-finding Ask Why and duplicate canonical review into the Inbox. The Timeline reads integrity events, never trace spans. Timeline export is explicit, bounded, redacted, and schema-validated; trace deletion stays isolated from audit/review lineage. Accessibility: keyboard navigation, narrow-pane layout, live announcements, focus management.

**Tests first:**

- [ ] Write failing Timeline tests that read integrity events and exclude trace spans.
- [ ] Write failing export tests for schema validation, redaction, and bounds.
- [ ] Write failing accessibility tests and trace-deletion-isolation tests.

**Implementation:**

- [ ] Implement the Timeline, the four-destination workspace, and the Inbox integrations.

**Verify:** `npx vitest run tests/ui tests/integration tests/packaging tests/privacy && npm run typecheck`

**Docs:** `docs/architecture.md`, `docs/security.md` export/redaction notes, `docs/progress.md`.

**Phase 34 gate:** the full gate command set from Phase 33; then promote `feat/phase-34-maintenance-workspace` to `development`.

**Commit boundary:** `feat: add integrity timeline and maintenance workspace`

---

## Phase 35 — Groq and Secrets

Branch: `feat/phase-35-groq-secrets` from `development` after the Phase 34 gate is promoted.

### Task 9: SecretStorage boundary and key migration

**Files:**

- Create: `src/plugin/secrets.ts`
- Modify: `src/plugin/settings.ts`, `src/main.ts`, `src/model-provider/local-provider.ts`
- Modify: `tests/plugin/settings.test.ts`, lifecycle tests, `tests/privacy`

**Interfaces/schema:** core provider configs no longer persist key values; the two layers are:

```ts
type PersistedCloudProviderSettings = {
  kind: "openai" | "hyperfusion" | "groq";
  endpoint: string;
  model: string;
  secretId: string;
  timeoutMs: number;
  maxResponseBytes: number;
};

type ResolvedCloudProviderConfig = Omit<PersistedCloudProviderSettings, "secretId"> & {
  apiKey: string;
};
```

Persisted settings use the first type; only the plugin boundary creates the second immediately before provider construction, and resolved config is never saved, logged, fingerprinted, traced, or exported. Settings store `secretId` values exactly: `vault-steward-openai-api-key`, `vault-steward-hyperfusion-api-key`, `vault-steward-groq-api-key` (lowercase, dash-separated). The plugin resolves the key only while constructing a provider. One-time migration: validate the old key, write SecretStorage first, save redacted settings second; if either step fails, keep a recoverable configuration and never log the key. After success, serialized settings contain no API key value. A missing or empty secret means not configured. Do not invent a deleteSecret API. Existing OpenAI/HyperFusion consents remain separate; Groq adds its own consent.

**Tests first:**

- [ ] Write failing migration tests: success removes key values, failure keeps recoverable state, and no key appears in logs, exports, or traces.
- [ ] Write failing tests that settings serialize only secret IDs.

**Implementation:**

- [ ] Implement `src/plugin/secrets.ts`, the migration, and provider-config changes.

**Verify:** `npx vitest run tests/plugin tests/privacy tests/model-provider && npm run typecheck`

**Docs:** `PRIVACY.md`, `docs/security.md`, `docs/upgrade-notes.md` migration note.

**Commit boundary:** `feat: move cloud api keys to secretstorage`

### Task 10: Groq adapter, discovery, and rate limits

**Files:**

- Create: `src/model-provider/groq-provider.ts`, `src/contracts/provider-discovery.ts`
- Modify: `src/model-provider/local-provider.ts`, `src/model-provider/readiness.ts`
- Create: `tests/model-provider/groq-provider.test.ts`, `tests/model-provider/groq-discovery.test.ts`
- Modify: privacy/security tests

**Interfaces/schema:** fixed origin `https://api.groq.com`; generation path `/openai/v1/chat/completions`; discovery path `/openai/v1/models`; `requestUrl` transport; reject redirects and any final wrong origin; auth header only to the fixed URLs. Discovery bounds: response body at most 1 MiB, at most 200 model entries, model IDs at most 200 characters, cache TTL 15 minutes. Cache key is provider plus a local key fingerprint held without the raw key; a cached discovery never authorizes generation after a failed refresh or a removed model. States are exactly Available, Compatible, Validated per the roadmap; compatibility comes from a bounded structured-output probe, not the models payload; Validated profile data is versioned from release reports, not a hard-coded selectable catalog; no auto-selection. On HTTP 429: parse integer `retry-after` seconds in 1..60 only, permit one retry only if it fits the remaining request/scan budget and the signal is not aborted; otherwise return a typed rate-limited incomplete outcome. Ignore arbitrary rate-limit headers except allowlisted bounded metadata; scheduled scans defer with no retry loop. Structured output fails closed under the existing evidence/prompt limits.

**Tests first:**

- [ ] Write a failing transport test/spike record for redirect rejection or final-origin verification (see the spike below before adapter work).
- [ ] Write failing adapter tests: fixed origin, redirect rejection, auth scoping, bounded reads, malformed-output failure.
- [ ] Write failing discovery tests: bounds, TTL, state transitions, removed-model blocking, no auto-selection.
- [ ] Write failing 429 tests: bounded single retry, budget/abort handling, typed incomplete outcome.

**Implementation:**

- [ ] First, perform and document a bounded production-transport compatibility spike: the installed Obsidian `requestUrl` contract exposes status/headers/body but no redirect mode or final URL, so the spike must prove that credential-bearing requests can reject redirects or verify the final origin. The current wrapper's constructed `Response.redirected` value is not evidence. Do not send Authorization in the spike to an untrusted endpoint, and do not switch to arbitrary global fetch without an approved Obsidian/security compatibility decision.
- [ ] Implement the Groq adapter and discovery contract behind the provider abstraction.

**Verify:** `npx vitest run tests/model-provider tests/privacy tests/security tests/contracts && npm run typecheck`

**Docs:** `docs/security.md` provider boundary, `docs/ai-system.md`.

**Commit boundary:** `feat: add groq provider adapter and discovery`

### Task 11: Groq settings, readiness, evaluation, and docs

**Files:**

- Modify: declarative settings, `src/main.ts`, UI, `PRIVACY.md`, `SECURITY.md`, `docs/troubleshooting.md`, `docs/local-models.md`, eval release contracts
- Create/modify: UI, docs, and eval tests

**Interfaces/schema:** the key input writes SecretStorage; the model dropdown lists discovered models with a stale-cache label; an unavailable saved model blocks a completed governed scan until reselected; refresh and test actions provided. Privacy copy states plainly that selected excerpts leave the device and provider retention is provider-controlled (not a Vault Steward guarantee). Deterministic tests use doubles. A protected live command/report may be added only using the existing eval pattern and explicit consent; the exact eval query/harness text must be lead-authored during execution, not delegated. No live credentials in CI.

**Tests first:**

- [ ] Write failing settings/UI tests for SecretStorage writes, discovered-model dropdown, stale-cache label, and removed-model blocking.
- [ ] Write failing docs tests for the privacy copy and experimental labeling.

**Implementation:**

- [ ] Wire Groq into settings and readiness; update docs and eval contracts.

**Verify:** `npx vitest run tests/plugin tests/ui tests/docs tests/evals && npm run typecheck`

**Docs:** `PRIVACY.md`, `SECURITY.md`, `docs/troubleshooting.md`, `docs/local-models.md`, `docs/release-compatibility.md`.

**Phase 35 gate:** the full gate command set plus provider-contract, privacy, security, and release-corpus tests; owner manual Groq evidence is required before any support claim, and docs label Groq experimental until it passes. If redirect rejection or final-origin verification cannot be enforced on the production transport, Groq implementation and support claims are blocked pending an approved security ADR — the requirement must not be silently weakened. Then promote `feat/phase-35-groq-secrets` to `development`.

**Commit boundary:** `feat: add groq settings and readiness`

---

## Phase 36 — Platform and Release

Branch: `feat/phase-36-platform-release` from `development` after the Phase 35 gate is promoted.

### Task 12: Windows and Linux automated and manual acceptance

**Files:**

- Modify: `.github/workflows/verify.yml`
- Create/modify: `docs/manual-acceptance-checklist.md` platform sections

**Interfaces/schema:** a CI matrix for windows, macOS, and ubuntu running format, lint, typecheck, build, unit, integration, and package-install where supported; live providers are never run in CI. Manual checklist sections cover fresh install/upgrade, SQLite/WASM, paths, local provider setup, governed scan, preview/apply/re-index, and unload/restart/recovery. A platform support claim exists only after owner evidence; failures stay documented rather than hidden.

**Tests first:**

- [ ] Write failing checklist/docs assertions for the new platform sections.

**Implementation:**

- [ ] Add the CI matrix and manual-checklist sections.

**Verify:** `npx vitest run tests/docs && npm run format:check`

**Docs:** `docs/manual-acceptance-checklist.md`, `docs/release-compatibility.md` (claims stay macOS-only until evidence lands).

**Commit boundary:** `test: add platform ci matrix and manual checklist`

### Task 13: Consented real-vault quality cases

**Files:**

- Create: local import/redaction contract and manifest files for consented cases
- Create: schema/redaction tests

**Interfaces/schema:** a local import and redaction contract plus manifest for user-consented quality cases; no collector, upload, telemetry, or pooled data. Only manually reviewed, redacted fixtures may be committed, each carrying provenance and consent metadata appropriate for the repository. Cases focus on false positives, provider setup failures, latency, and confusing recommendations. Correctness-critical eval manifest/grader/query text must be lead-authored during execution. No note body is accepted without explicit fixture review.

**Tests first:**

- [ ] Write failing schema and redaction tests for the contract and manifest.

**Implementation:**

- [ ] Implement the contract, manifest, and fixture pipeline.

**Verify:** `npx vitest run tests/evals tests/contracts && npm run typecheck`

**Docs:** `EVALS.md` per existing conventions, `PRIVACY.md` case-consent note.

**Commit boundary:** `test: add consented real-vault quality cases`

### Task 14: Completion and release gate

**Interfaces/schema:** the version stays untouched until the owner release task. The full gate is exactly: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run test:acceptance`, `npm run test:coverage`, `npm run eval:smoke`, `npm run eval:full`, `npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json`, `npm run perf:smoke`, `npm run ops:smoke`, `npm run security:check`, `npm run test:plugin-install`. Copyable gate:

```bash
npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:acceptance && npm run test:coverage && npm run eval:smoke && npm run eval:full && npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json && npm run perf:smoke && npm run ops:smoke && npm run security:check && npm run test:plugin-install
```

Manual matrices and the protected Groq report are explicit unavailable blockers — never silently skipped. Update all authority docs, public docs, changelog, and `docs/progress.md`; set ADR statuses based on evidence only. Release, tag, push, and Community submission are owner actions and must not be executed without explicit request.

**Tests first:**

- [ ] Write failing release-readiness assertions where doc tests require them.

**Implementation:**

- [ ] Update documentation and readiness records to reflect verified evidence only.

**Verify:** the full gate command list above.

**Docs:** `docs/progress.md`, `CHANGELOG.md`, `docs/release-readiness.md`, ADR statuses.

**Commit boundary:** `docs: record 0.3.0 completion evidence`

---

## Plan self-review

### Coverage matrix

| Roadmap 0.3.0 item                                        | Tasks         |
| --------------------------------------------------------- | ------------- |
| 1. Stable finding identity and snapshot-bound occurrences | 1, 2, 3, 4    |
| 2. Append-only typed integrity event store                | 1, 2, 5       |
| 3. Changes Since Last Check                               | 2, 3, 4, 5, 6 |
| 4. Steward Inbox dispositions                             | 2, 5, 7       |
| 5. Basic Timeline                                         | 2, 5, 8       |
| 6. Ask Why and duplicate canonical review in Inbox        | 8             |
| 7. Groq fixed-origin opt-in provider                      | 10, 11        |
| 8. Groq model qualification states                        | 10, 11        |
| 9. SecretStorage for cloud API keys                       | 9             |
| 10. Windows and Linux validation                          | 12            |
| 11. Consented real-vault quality cases                    | 13            |

### Dependency review

Tasks land in order: contracts before storage, storage before adapters and subjects, identity before comparison, comparison before workspace surfaces, secrets before the Groq adapter, and platform/release last. No task depends on deferred 0.4/0.5 work.

### Privacy review

Integrity events carry only allowlisted metadata; keys live only in SecretStorage; exports are explicit, schema-validated, redacted, and bounded; real-vault cases require consent and manual redaction review; no telemetry or pooled data is introduced.

### Migration review

Migration 12 is forward-only and additive; legacy findings backfill as isolated `identityVersion: 0` occurrences; proposal digests and approval authority are untouched; backfill is idempotent and transactional.

### Verification review

Every task lists its focused command; each phase ends with the full gate before promotion; protected live/manual evidence is an explicit blocker, never skipped silently.

### Deferred to 0.4.0/0.5.0

Health score formula and 0-100 presentation, impact weighting and blast radius, expanded decision lifecycle, relationship anomalies and repairs, trend segments, learned rule/policy suggestions, expanded Ask Why, provider-aware scheduled semantic checks, and richer timeline/comparison. In 0.3.0, user-visible Health remains the existing status/counts summary.

```

```
