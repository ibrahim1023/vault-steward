# Data Model

## Authority

This document owns persisted domain concepts and lifecycle. The forward-only SQLite schema is implemented in `src/storage/migrations.ts`; repository record shapes are implemented in `src/storage/repositories.ts`.

## Core Records

| Record        | Key fields                                                          | Notes                                                    |
| ------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `scan`        | `id`, vault fingerprint, started/finished time, status, config hash | immutable run boundary                                   |
| `note`        | stable file ID, path, revision hash, frontmatter, body metadata     | content stays local                                      |
| `node`        | `id`, `kind`, scan ID, source note ID, display label                | kinds: note, entity, project, task, decision, attachment |
| `edge`        | `id`, scan ID, from, to, relation, evidence locator                 | relations from `spec.md`                                 |
| `policy`      | ID, YAML source hash, enabled status                                | parsed before evaluation                                 |
| `finding`     | required fields from `spec.md`, scan ID, lifecycle status           | user-reviewable output                                   |
| `proposal`    | finding ID, patch, source revisions, status                         | cannot be applied stale                                  |
| `approval`    | proposal ID, user action, timestamp, applied revision               | append-only audit record                                 |
| `model_trace` | request metadata, schema version, timing, token counts, outcome     | excludes note text by default                            |

## Consistency and Transactions

Each scan writes within a transaction per bounded batch, then marks the scan complete only after all projections and deterministic checks succeed. Findings become visible only for completed scans. Applying a proposal rechecks current file revisions, writes the file through the vault adapter, records the approval, and schedules re-indexing as one recoverable operation.

## Lifecycle and Retention

Raw note text is read from the vault, not duplicated unless a user explicitly enables a local cache. SQLite retains normalized metadata, evidence locators, hashes, findings, approvals, and aggregate traces. Stale scan records remain replayable until user-managed cleanup; cleanup must preserve audit records unless explicitly purged.

## Migrations and Concurrency

Migrations are forward-only, versioned, and tested against a populated fixture database. A single plugin process serializes writes; read views use the last completed scan while a new scan is running. Re-running the same scanner input is idempotent by `(vault fingerprint, file ID, revision hash, parser version)`.
