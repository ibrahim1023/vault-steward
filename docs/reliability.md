# Reliability and Operations

## Reliability Model

Local correctness takes precedence over scan throughput. All externally visible results are tied to a completed scan snapshot. A canceled or failed scan must never replace the prior completed view.

## Controls

- Correlation IDs connect scan, agent, finding, proposal, approval, and apply events.
- Structured local logs record operation IDs, counts, durations, versions, outcome codes, and redacted errors.
- Retry only transient local-model or vault-read failures, with capped exponential backoff and cancellation awareness.
- Deduplicate work by scan and input hashes; cap parser/model queue depth; process model calls serially at first.
- Recover after restart by marking interrupted scans failed/canceled, retaining their diagnostics, and resuming only from a safe checkpoint.
- Reject non-SQLite persisted bytes as corruption; rebuild derived local state through the recovery runbook rather than silently replacing the database.
- Recheck source revisions before apply; a mismatch transitions the proposal to `stale`.

## Health and Diagnostics

The UI exposes vault access, database migration state, last completed scan, local-provider availability, and bounded error summaries. Planned metrics: scan duration, files parsed, parse errors, model latency, structured-output failures, finding counts, stale proposals, apply failures, retries, tokens, and queue depth. No metric includes note content.

## Runbook Triggers

Document procedures before implementing: database migration failure, corrupted index, provider unavailable, repeated structured-output failure, oversized vault, canceled scan, and apply/re-index mismatch. Recovery favors rebuilding local derived state from the vault and retaining approvals/audit records.
