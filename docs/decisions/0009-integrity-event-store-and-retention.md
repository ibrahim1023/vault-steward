# ADR 0009: Append-Only Integrity Events and Retention Boundaries

## Status

Implemented (Phase 33 event-store foundation); accepted on 2026-09-28. The
append-only event store, monotonic sequence, exact-duplicate idempotency,
retention settings and repository operations, explicit purge, and deletion
ledger are implemented. Operational scan events, review transition events, and
proposal/apply audit events commit with their canonical transitions;
interrupted scans and applies record recovery outcomes at startup. Timeline UI
projections, disposition events, and scheduled retention wiring remain pending
under later tasks.

## Context

Current trace spans are optional diagnostics that can be deleted, the current
lifecycle is derived aggregate state, and approvals are protected domain audit
records. The proposed 0.3.0 Timeline, Inbox, and Changes need typed durable
events without turning optional traces into authority.

This ADR extends ADR 0003's audit boundary. It does not replace scans,
findings, proposals, or approvals as canonical domain records.

## Decision

### Event contract

```ts
type IntegrityEventCategory = "audit" | "review" | "operational";

type IntegrityEvent = {
  schemaVersion: 1;
  sequence: number;
  id: string;
  category: IntegrityEventCategory;
  kind: string;
  occurredAt: string;
  scanId?: string;
  stableKey?: string;
  occurrenceId?: string;
  proposalId?: string;
  approvalId?: string;
  safeMetadata: Record<string, string | number | boolean | null>;
};
```

### Store rules

- The SQLite table uses `sequence INTEGER PRIMARY KEY AUTOINCREMENT`; sequence
  is the canonical local ordering and `occurredAt` is display and filter only.
  `id` is a caller-supplied UUID used as an idempotency key with a UNIQUE
  constraint.
- Append only: there is no update API. The domain transition and its event
  append occur in one SQLite transaction. A duplicate event ID is an idempotent
  no-op only when every field matches exactly; a mismatch fails closed as an
  integrity error.
- Events are timeline projections, not authority to approve, apply, or
  reconstruct deleted note content. Existing canonical domain tables remain
  authoritative.
- Unknown kind or schema values remain stored but are not rendered as known
  actions; writers reject unknown local kinds. Runtime reads validate size and
  type.
- Bounds: kind length 80 characters, IDs 256, at most 32 metadata entries,
  metadata keys 64 characters, string values 256, serialized metadata 4096
  bytes. Numeric values must be finite. No nested objects or arrays.

### Categories and kinds

- `audit`: proposal prepared, approved, dismissed, deferred, stale,
  apply-started, applied, apply-failed, rolled-back, and recovery-required,
  plus policy-save approvals. Never automatically pruned.
- `review`: finding opened, changed, recurred, and resolved, plus disposition
  acknowledged, ignored, snoozed, expected, and restored. Never automatically
  pruned in 0.3.0 because it owns Inbox and recurrence history; explicit purge
  only.
- `operational`: scan started, completed, incomplete, canceled, and failed;
  schedule triggered and deferred; provider readiness and rate-limit safe
  outcomes. Retained under the operational policy below.
- Existing `trace_spans`, agent executions, snapshots, configurations, and
  lineage remain a separate optional `diagnostic` system and are not
  IntegrityEventCategory values.

### Privacy

- `safeMetadata` is an allowlist per event kind: only opaque IDs, generic
  codes, counts, durations, formula and configuration versions, provider and
  model identifiers, bounded retry and reset seconds, and booleans.
- Never store note bodies or excerpts, prompts or raw model outputs, API keys
  or auth headers, absolute or vault-relative paths, URLs, request payloads,
  arbitrary provider headers, policy source, or replacement or current note
  text. Hashes derived from paths or content are not exported as if anonymous;
  opaque stable and subject IDs can remain local.
- Timeline export must be explicit, schema validated, redacted, and bounded,
  and must exclude non-allowlisted fields.

### Retention

- `audit` and `review` events are retained locally until an explicit
  user-confirmed purge. They are not affected by current trace retention or
  delete controls or by automatic cleanup. An explicit purge removes the
  selected category or range only after a dependency preflight and records a
  category, count, and time summary in a separate retention-deletion ledger
  that contains no deleted record IDs or content.
- `operational` events default to 180 days, configurable within 30 to 3650
  days. Automatic pruning preserves at least the latest 50 completed scans and
  every operational event referenced by retained audit or review events. If the
  age policy conflicts with either preservation constraint, dependency and
  minimum-scan preservation win. Pruning is transactional and records an aggregate
  deletion-ledger entry.
- `diagnostic` data keeps the existing default of 30 days and its existing
  controls unchanged.
- Minimal identity and occurrence records referenced by retained audit or
  review events remain even when larger scan projections are pruned.
- There is no automatic global event-count deletion. Before implementation,
  performance tests must establish a database-size budget; if future hard caps
  are needed, a new ADR is required and protected categories may not be
  silently evicted.

### Deletion ledger

- A new generalized retention-deletion ledger is append-only and records
  sequence, time, category, reason, count, and range fields only: no event IDs,
  paths, evidence, or content. The existing `telemetry_deletions` table remains
  historical and may be migrated or bridged without falsifying history.

### Consistency and recovery

- The single plugin process serializes writes. Event append shares one
  transaction with the domain state transition. On startup, interrupted scans
  or applies append a recovery outcome only when canonical state proves the
  transition; a successful apply is never synthesized from events. Sequence
  gaps are allowed after rollback or deletion and are never renumbered.
- Correlation IDs remain diagnostic join aids, not event identity or ordering
  authority.

## Alternatives considered

- Reuse trace spans as timeline authority — rejected: they are optional and
  deletable.
- Order events by timestamp — rejected: clocks are unreliable; the database
  sequence is canonical.
- One mutable history row per entity — rejected: it loses append-only lineage.
- Generic JSON event payloads — rejected: they are unbounded and unredactable.
- Delete all history under trace controls — rejected: audit and review lineage
  must survive diagnostic deletion.
- A global FIFO event cap — rejected: it could silently evict protected
  categories.

## Consequences

- New migrations, repositories, transaction boundaries, and typed kind
  allowlists.
- Retention UI wording and timeline export behavior change.
- A database-size budget gate is required before implementation.

## Required tests

- Monotonic sequence ordering, including same-timestamp events.
- Idempotent exact-duplicate append versus fail-closed mismatch.
- Transaction rollback of the domain transition plus event append.
- Category allowlists, field bounds, and metadata redaction.
- Trace deletion does not remove audit, review, or operational events.
- Operational retention: 180-day default, 30 to 3650 day configurability,
  minimum 50 completed scans, and dependency preservation.
- Explicit audit and review purge preflight plus ledger entry.
- Restart recovery appends outcomes only from proven canonical state.
- Readers tolerate unknown kinds without rendering them as known actions.
- Export schema validation and redaction.
- Scale and database-size budget coverage.
