# Observability And Retained Data

Vault Steward records local metadata to make scans and findings inspectable without retaining default note content. SQLite owns scan state, findings, approvals, audit records, trace spans, lineage, and configured retention metadata.

## What Is Stored

Default records include scan IDs, timestamps, status, configuration fingerprints,
prompt-registry hashes, durations, retry counts, aggregate token estimates, safe
error codes, evidence locators, and lineage identifiers. Trace inspection shows a
parented scanner, parser, indexing, retrieval, agent, validation, policy,
coordinator, proposal, and apply timeline. Optional controls govern redacted
prompt/model snapshots and retention categories.

## What Is Excluded By Default

The default trace/report boundary excludes note bodies, excerpts, prompts, raw model outputs, absolute vault paths, URLs, and secrets. Evaluation reports store identifiers and aggregate measurements only.

## Controls

The plugin exposes retention, per-scan deletion, delete-all telemetry, inventory,
and privacy-safe JSON copy/export controls. Approval/audit records remain protected
unless the user explicitly confirms their deletion. The Diagnostics surface also
shows a content-free evidence chain, operational metrics, lifecycle-based health
trends, prompt registry metadata, fixture-only replay eligibility, and guarded
snapshot metadata. Replay eligibility describes whether retained inputs can support
a run; it does not reconstruct unavailable source.

See `docs/architecture.md`, `docs/interfaces.md`, and `docs/runbooks.md` for component and recovery detail.
