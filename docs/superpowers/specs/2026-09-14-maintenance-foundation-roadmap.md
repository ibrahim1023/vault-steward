# Vault Steward Maintenance Roadmap

- Status: Proposed
- Current public baseline: `0.2.1`
- Immediate target: `0.3.0` — Maintenance Foundation
- Later targets: `0.4.0` — Prioritization and Impact; `0.5.0` — Ongoing Intelligence
- Last updated: 2026-09-14

This roadmap turns the shipped scanner and review queue into dependable ongoing
maintenance. It preserves the product's non-negotiable boundaries: local-first
operation, evidence-first findings, explicit user approval, deterministic
writes, no autonomous editing, and no telemetry or remote vault storage.

`spec.md` remains authoritative for shipped behavior. This document governs
proposed release scope only; each item becomes committed work after its
required ADR and design gates are approved.

## Questions the product must answer

- Health: how healthy is my vault right now?
- Change: what changed since the last check?
- Priority: what should I fix first?
- Why: why is this a problem, and what evidence supports it?
- Exact impact: what exactly will this fix change?

## Product principles and non-goals

- Findings are evidence-bound and reproducible. A score, ranking, or model
  suggestion never authorizes a write.
- Approval, apply, and rollback lineage are append-only audit records that
  outlive optional diagnostics.
- Cloud providers are explicit opt-in paths with fixed origins, separate
  consent, and no background transmission under ordinary consent.
- Non-goals: general chat, autonomous editing, silent policy tuning,
  destructive merge/rename/delete automation, telemetry, pooled training data,
  and remote vault storage.

## 0.3.0 — Maintenance Foundation

Committed scope, in dependency order:

1. **Stable finding identity plus snapshot-bound occurrence IDs.** A finding's
   stable identity is deterministic and excludes scan ID, severity, confidence,
   explanation or model phrasing, and excerpts. An occurrence remains bound to
   one scan and one evidence revision. Illustrative contract:

   ```ts
   interface FindingIdentity {
     identityVersion: number;
     stableKey: string;
   }

   interface FindingOccurrence {
     occurrenceId: string;
     stableKey: string;
     scanId: string;
     evidenceRevisionKey: string;
   }
   ```

   The full identity, occurrence, subject, rename, disposition, comparison, and
   migration rules are decided in
   [ADR 0008](../../decisions/0008-stable-finding-identity-and-occurrences.md)
   (accepted for planning; not implemented).

2. **Append-only typed integrity event store.** Every event carries a schema
   version, a database-assigned monotonic sequence, a timestamp, and safe IDs
   and metadata. Required approval/apply audit events, operational events, and
   optional diagnostic traces are explicitly separate categories. Deleting
   optional diagnostic traces cannot affect Health, Changes, or approval
   lineage. Categories, bounds, privacy allowlists, retention, and the deletion
   ledger are decided in
   [ADR 0009](../../decisions/0009-integrity-event-store-and-retention.md)
   (accepted for planning; not implemented).

3. **Changes Since Last Check.** Comparison runs between completed compatible
   scans only and reports new, unchanged, changed, recurring, and resolved
   findings. An incomplete scan never resolves findings. Comparison state is
   persisted so restart correctness holds. Rename behavior follows
   [ADR 0008](../../decisions/0008-stable-finding-identity-and-occurrences.md).

4. **Steward Inbox dispositions.** Dispositions are separate from canonical
   finding status: `acknowledged`, `ignored`, `snoozed`, `expected`, and
   `restored`. Repairable findings use the action label `Review fix` rather
   than the ambiguous `Accept`. No Inbox action writes to the vault; apply
   remains the separate exact-preview, explicit-approval, preflight path.
   Dispositions are reversible state with append-only history.

5. **Basic Timeline.** The timeline connects scan, finding occurrence and
   disposition, proposal, approval, apply, and rollback or recovery events.
   Required audit lineage is not deleted together with optional diagnostics.

6. **Inbox integration of existing review tools.** The existing
   selected-finding Ask Why and the duplicate canonical review move into the
   Inbox. This does not expand into general chat or into destructive
   merge, rename, or delete operations.

7. **Groq fixed-origin opt-in provider.** `GROQ_ORIGIN = "https://api.groq.com"`
   with API base `/openai/v1`. Only the defined model-discovery and generation
   paths are allowed, and redirects are rejected. Groq requires its own
   separate consent. No scheduled cloud inference is permitted under ordinary
   consent.

8. **Groq model qualification states.** Model states are exactly `Available`
   (returned by an authenticated `GET /models`), `Compatible` (passes a bounded
   structured-output readiness probe), and `Validated` (passes the versioned
   Vault Steward release corpus). Discovery alone never implies compatibility
   or quality. There is no hard-coded selectable catalog; a versioned
   validated-profile list is allowed. If the selected model is removed, it
   blocks governed completion until the user reselects. Response bytes,
   discovered model count, and discovery cache TTL are bounded. A 429 response
   permits one bounded retry only when `retry-after` fits the scan budget;
   otherwise the scan is incomplete or deferred.

9. **SecretStorage for cloud API keys.** All OpenAI, HyperFusion, and Groq API
   key values move to Obsidian SecretStorage, which is available under the
   current minimum app version. Plugin settings persist only secret IDs; a
   one-time migration removes ordinary stored key values. Exports and traces
   never include key values.

10. **Windows and Linux validation.** Manual matrices cover install, the
    SQLite/WASM runtime, path handling, provider setup, scanning, preview,
    apply safety, and unload behavior. Windows and Linux support may be claimed
    only after those matrices pass.

11. **Consented real-vault quality cases.** A user-consented, redacted
    real-vault quality-case workflow focuses on false positives, provider setup
    failures, latency, and confusing recommendations. It is never telemetry and
    never pooled training data.

### Scheduled behavior in 0.3.0

Deterministic scheduled checks may remain disabled by default. Scheduled cloud
semantic checks are explicitly out of scope for `0.3.0` unless a separate
provider-specific opt-in is later implemented. Ordinary provider consent cannot
authorize background cloud transmission.

### 0.3.0 acceptance criteria

- Stable finding identity survives restart; occurrences stay bound to their
  scan and evidence revision.
- Incomplete scans never resolve findings in Changes Since Last Check.
- Every Inbox disposition can be set, returned to, and restored, with
  append-only history and no canonical-status overwrite.
- Timeline audit lineage survives deletion of optional diagnostics.
- No Inbox action performs a vault write; apply keeps its separate
  preview/approval/preflight path.
- Groq: separate consent, fixed origin with redirect rejection, discovery that
  never implies qualification, removed-model blocking until reselection,
  bounded single 429 retry, and fail-closed malformed-output handling.
- SecretStorage migration removes stored key values and keeps keys out of
  exports, traces, fingerprints, and diagnostics.
- Package and platform matrices pass before support claims; Windows and Linux
  are not claimed validated before evidence exists.
- All existing exact-preview, explicit-approval, stale-revision, and rollback
  protections remain unchanged.

## 0.4.0 — Prioritization and Impact

Scope:

- Category Health dashboard driven by a deterministic versioned formula with
  published factor values.
- Impact-weighted staleness, bounded graph impact, and a deterministic blast
  radius for proposed repairs.
- Expanded policy-backed decision lifecycle, relationship anomalies, and
  comparable trend segments.

Boundaries:

- Exact operation effects are separated from expected post-scan outcomes.
- Semantic duplicate resolution is re-evaluated per scan, not guaranteed.
- Missing-target anomaly evidence is built from the source, deterministic
  absence, and policy or schema expectations — never from evidence about a
  nonexistent target.
- No score or impact value authorizes a write.

Before `0.4.0` implementation begins, ADR/design decisions are required for:

- The exact health formula: contributing statuses, confidence handling,
  severity weights, impact caps, denominator, repeated-family cap, treatment of
  incomplete factors, snoozed/expected findings, and the zero-findings state.
- Score calibration using user-consented cases.
- The impact formula and its bounds.
- The safe relationship repair families.

Status and counts remain the primary presentation; the 0-100 score stays
secondary.

## 0.5.0 — Ongoing Intelligence

Scope:

- Learned rule and policy suggestions expressed in a typed, versioned pattern
  vocabulary rather than the current type-plus-path key. Each suggestion shows
  a deterministic simulated effect and is saved only through an explicit
  Policy Studio action.
- Expanded fixed-question Ask Why with citation validation.
- Provider-aware scheduled semantic checks gated by separate provider-specific
  background-cloud consent.
- Richer timeline and comparison views.
- Only narrow schema-backed relationship repairs that have been proven safe.

Non-goals for this release: no general chat, no autonomy, and no silent tuning.

## Cross-release contracts

- **Stable identity versus occurrence.** `FindingIdentity.stableKey` survives
  scans and presentation changes; `FindingOccurrence` is always bound to one
  `scanId` and one `evidenceRevisionKey`.
- **Inbox dispositions.** Illustrative union:

  ```ts
  type ReviewDisposition =
    | { kind: "acknowledged"; at: string }
    | { kind: "ignored"; at: string; reason?: string }
    | { kind: "snoozed"; at: string; until?: string; untilEvidenceChanges: boolean }
    | { kind: "expected"; at: string; reason?: string }
    | { kind: "restored"; at: string };
  ```

- **Provider capabilities and discovered models.** Typed
  `ProviderCapabilities` and `DiscoveredModel` contracts are validated at
  runtime and bounded in size and count:

  ```ts
  interface ProviderCapabilities {
    provider: "ollama" | "llama.cpp" | "openai" | "hyperfusion" | "groq";
    supportsModelDiscovery: boolean;
    supportsStructuredOutput: boolean;
    requiresCloudConsent: boolean;
    maxResponseBytes: number;
  }

  interface DiscoveredModel {
    provider: string;
    modelId: string;
    state: "available" | "compatible" | "validated";
  }
  ```

- **Blast radius.** Exact planned operation effects, derived from the
  validated proposal, are reported separately from expected post-scan outcomes,
  which are predictions confirmed only by the next completed scan.
- **Retention and privacy.** Integrity events and Inbox history may store safe
  IDs, generic codes, timestamps, and bounded metadata. They must never store
  note content, prompts, key material, or absolute vault paths outside an
  approved diagnostic mode. Provider-side data handling is governed by each
  provider's own terms and is not a Vault Steward guarantee.
- **Cloud scheduling consent.** Background cloud consent is a separate,
  provider-specific decision from foreground provider consent; the foreground
  acknowledgement never implies it.

## Implementation sequence

1. Stable identity and occurrence ADR and contracts.
2. Integrity event store and retention ADR plus migrations.
3. Changes Since Last Check.
4. Steward Inbox dispositions.
5. Timeline.
6. Groq provider plus SecretStorage migration.
7. Windows and Linux acceptance.
8. Real-vault calibration cases.
9. Health dashboard and impact.
10. Decision lifecycle and relationship anomalies.
11. Blast radius.
12. Learning and advanced scheduling.

## Decisions required before implementation

- Validated Groq profiles and qualification behavior.
- The exact health formula.
- Critical suppression policy.
- Safe relationship repair fields.
- Scheduled-cloud consent UX.

The foundational ADR gates are resolved: stable identity and occurrences
([ADR 0008](../../decisions/0008-stable-finding-identity-and-occurrences.md))
and the append-only integrity event store and retention boundaries
([ADR 0009](../../decisions/0009-integrity-event-store-and-retention.md)) were
accepted for planning on 2026-09-28. The bounded
[0.3.0 implementation plan](../plans/2026-09-28-maintenance-foundation.md) was
approved on 2026-09-28; no runtime changes have started. The next gate is
landing the planning documentation and creating the Phase 33 branch from an
up-to-date `development`.

## 0.3.0 release checklist

- Identity/occurrence and event/retention ADRs accepted on 2026-09-28; not yet
  implemented.
- Changes, Inbox, and Timeline covered by restart, incomplete-scan, and
  disposition-restore tests.
- Groq consent, origin pinning, qualification states, removed-model blocking,
  and bounded retry covered by deterministic tests.
- SecretStorage migration verified; keys absent from exports and traces.
- Windows and Linux manual matrices recorded before any support claim.
- Real-vault quality cases collected only with consent and redaction.
- Existing preview, approval, revision, and rollback protections re-verified.

## Sources

Groq provider design references the official Groq documentation:

- [OpenAI compatibility](https://console.groq.com/docs/openai)
- [Supported models and the models endpoint](https://console.groq.com/docs/models)
- [Structured outputs](https://console.groq.com/docs/structured-outputs)
- [Rate limits](https://console.groq.com/docs/rate-limits)
- [GroqCloud data handling and controls](https://console.groq.com/docs/your-data)
