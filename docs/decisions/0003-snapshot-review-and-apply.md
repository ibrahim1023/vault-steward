# ADR: Snapshot-Bound Review and Apply Workflow

## Status

Accepted for the foundation.

## Context

Findings can become invalid after a vault changes. The specification requires diff preview, explicit approval, apply, and re-index.

## Decision

Each scan receives an immutable ID. Findings and proposals record evidence/source revisions. Apply revalidates current revisions and marks mismatched proposals stale instead of applying them.

## Alternatives considered

- Apply against latest files without revision checks
- Auto-refresh and silently rewrite proposals
- Do not persist scan snapshots

## Reasons

Snapshot binding makes user approval meaningful and provides an audit/replay boundary.

## Tradeoffs

Users occasionally re-run scans or recreate proposals after edits.

## Consequences

Storage needs scan/proposal/approval records and the UI needs a stale state.

## Migration or reversal strategy

Version scan and patch schemas; preserve audit records during migrations.
