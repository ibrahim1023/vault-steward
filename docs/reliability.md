# Reliability and Operations

## Reliability Model

Local correctness takes precedence over scan throughput. All externally visible results are tied to a completed scan snapshot. A canceled or failed scan must never replace the prior completed view.

## Controls

- Correlation IDs connect scan, agent, finding, proposal, approval, and apply events.
- Structured local logs record operation IDs, counts, durations, versions, outcome codes, and redacted errors.
- Retry only transient local-model or vault-read failures, with capped exponential backoff and cancellation awareness.
- Deduplicate work by scan and input hashes; cap parser/model queue depth; process model calls serially at first.
- Normalize event bursts before scan scheduling. Empty, overflowed, malformed, create, rename, and delete batches are full-scan boundaries; only exact safe modify events can qualify for incremental parser reuse.
- Recover after restart by marking interrupted scans failed/canceled, retaining their diagnostics, and resuming only from a safe checkpoint.
- Reject non-SQLite persisted bytes as corruption; rebuild derived local state through the recovery runbook rather than silently replacing the database.
- Join prepared batches to persisted digest-bound proposals and recheck every
  source revision before apply. Any stale, altered, missing, conflicting, or
  unauthorized member aborts the whole batch before writes.
- Construct all non-overlapping operations for a file from one preflight snapshot and apply them in descending offset order. If a later file write fails, restore each earlier successful write from its preflight content before marking the proposal `apply-failed`.

## Health and Diagnostics

The UI exposes vault access, database migration state, last completed scan, finding recurrence, local-provider availability, and bounded error summaries. Operational metrics gate scan duration, parse errors, parser-reuse eligibility, event queue depth, model latency, token usage, tool calls, retry rate, incomplete rate, finding volume, stale proposals, and apply failure rate. No metric includes note content.

## Runbook Triggers

Document procedures before implementing: database migration failure, corrupted index, provider unavailable, repeated structured-output failure, oversized vault, canceled scan, and apply/re-index mismatch. Recovery favors rebuilding local derived state from the vault and retaining approvals/audit records.
