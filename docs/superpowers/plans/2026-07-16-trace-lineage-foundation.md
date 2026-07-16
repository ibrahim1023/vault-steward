# Trace and Finding Lineage Foundation Implementation Plan

**Goal:** Persist inspectable, metadata-only scan lineage and reject unsupported findings before review.

**Constraints:** No note text, prompts, raw outputs, absolute paths, endpoints, or secrets in default records. All new records are schema-versioned and local-only.

1. Add `src/contracts/trace.ts` with redaction validation, scan/span/agent/validator/policy/lineage/config contracts and unit tests.
2. Add SQLite migration and repository methods for trace and retention records; test fresh install, upgrade, rollback, and deletion transactions.
3. Instrument governed-scan, coordinator, policy, and persistence boundaries with typed metadata events.
4. Add lineage validation before finding persistence and test each reject path.
5. Add metadata retention, deletion, inventory APIs, privacy documentation, full gate, and phase promotion.
