# Privacy-Preserving Trace and Finding Lineage Foundation

Phase 12 adds local, structured traceability without retaining vault content. Trace contracts use correlation IDs, vault-relative locators, hashes, durations, counts, schema versions, result codes, and configuration fingerprints only. They explicitly reject note bodies, excerpts, prompts, raw model output, endpoints, absolute paths, and secrets.

SQLite receives forward-only tables for scans, spans, agent executions, validator and policy outcomes, finding-lineage edges, configuration metadata, retention settings, and deletion audit records. Every final finding must have evidence, a parsed-artifact locator, a validator outcome, coordinator decision, and, for model-assisted claims, a recorded agent execution. Missing lineage rejects the candidate before review-queue persistence.

Retention supports bounded metadata-only cleanup, per-scan deletion, delete-all telemetry, and an inventory of stored categories. Approval records remain unless an explicit separate confirmation requests their deletion. Phase 13 will render this data; Phase 12 exposes only repository APIs and deterministic validation.
