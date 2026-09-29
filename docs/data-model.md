# Data Model

## Authority

This document owns persisted domain concepts and lifecycle. The forward-only SQLite schema is implemented in `src/storage/migrations.ts`; repository record shapes are implemented in `src/storage/repositories.ts`.

## Core Records

| Record               | Key fields                                                                        | Notes                                                        |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `scan`               | `id`, vault fingerprint, started/finished time, status, config hash               | immutable run boundary; `scan_inputs` stores paths/revisions |
| `note`               | stable file ID, path, revision hash, frontmatter, body metadata                   | content stays local                                          |
| `node`               | `id`, `kind`, scan ID, source note ID, display label                              | kinds: note, entity, project, task, decision, attachment     |
| `edge`               | `id`, scan ID, from, to, relation, evidence locator                               | relations from `spec.md`                                     |
| `policy`             | ID, YAML source hash, enabled status                                              | parsed before evaluation                                     |
| `finding`            | required fields from `spec.md`, scan ID, lifecycle status                         | user-reviewable output                                       |
| `proposal`           | finding ID, patch, source revisions, status                                       | cannot be applied stale                                      |
| `approval`           | proposal ID, user action, timestamp, applied revision                             | append-only audit record                                     |
| `model_trace`        | request metadata, schema version, timing, token counts, outcome                   | excludes note text by default                                |
| `parse_product`      | scan ID, parser version, normalized path, revision and metadata hashes            | parser-reuse eligibility; no note body retained              |
| `parse_dependency`   | scan ID, source path, target path, relation                                       | persisted reference dependency projection                    |
| `note_subject`       | opaque subject ID, current path, created/deleted time                             | path is an attribute, not identity                           |
| `note_path_history`  | subject ID, path, observed/retired time                                           | verified rename continuity                                   |
| `finding_identity`   | stable key, identity version, family/subtype, detector, subject IDs, semantic key | cross-scan conceptual identity                               |
| `finding_occurrence` | occurrence ID, stable key, finding ID, scan ID, evidence revision key             | scan-bound manifestation of one identity                     |
| `review_disposition` | stable key, source occurrence/evidence, kind, snooze bounds, restore target       | reversible review decision                                   |
| `integrity_event`    | sequence, category/kind, occurred at, reference IDs, safe metadata                | append-only projection; no note content                      |
| `retention_deletion` | sequence, category, reason, count, occurred range                                 | aggregate deletion ledger                                    |

## Consistency and Transactions

Each scan writes within a transaction per bounded batch, then marks the scan complete only after all projections and deterministic checks succeed. Findings become visible only for completed scans. Applying a proposal rechecks current file revisions, writes the file through the vault adapter, records the approval, and schedules re-indexing as one recoverable operation.

## Lifecycle and Retention

Raw note text is read from the vault and is not duplicated into parse-product history. SQLite retains normalized metadata, evidence locators, hashes, dependency targets, findings, approvals, and aggregate traces. Finding lifecycle is derived from completed scan records; a finding is resolved when it is absent from a later completed scan, while stale remains an explicit persisted finding status. Stale scan records remain replayable until user-managed cleanup; cleanup must preserve audit records unless explicitly purged.

Integrity events are projections, not canonical domain rows. Operational events
age out after the configured operational window (30–3650 days, seeded 180) while
preserving the latest 50 completed scans and any scan referenced by a retained
audit or review event; audit and review events are removed only by explicit
purge. Every removal appends one aggregate row to `retention_deletions`, and
neither path deletes findings, identities, occurrences, proposals, or
approvals. Findings recorded before identity adoption receive isolated
`identityVersion: 0` keys and occurrences through an idempotent backfill at
database open; legacy rows are never merged across scans, and proposal and
approval digests are unchanged.

## Migrations and Concurrency

Migrations are forward-only, versioned, and tested against a populated fixture database. Supplied versions must be positive, strictly increasing, and duplicate-free, and the applied set must form a prefix of the supplied sequence; violations are rejected before any mutation. A single plugin process serializes writes; read views use the last completed scan while a new scan is running. Re-running the same scanner input is idempotent by `(vault fingerprint, file ID, revision hash, parser version)` plus the scan's `identity_profile_hash` (`legacy` by default).
