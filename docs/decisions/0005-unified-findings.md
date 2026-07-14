# ADR: Unified Evidence-Validated Findings

## Status

Accepted

## Context

Vault Steward has deterministic checks and bounded local-model agents. Their outputs must be presented and persisted through one stable contract without allowing model labels or uncited content to influence review or mutation workflows.

## Decision

Use the versioned `Finding` contract for all supported issue families: reference integrity, entity aliases, contradictions, staleness, tasks, schemas, decisions, and policies. `src/findings/normalize.ts` is the sole promotion boundary. It validates supported types, finite confidence, non-empty explanations, and exact membership of every cited evidence item in the immutable scan evidence set. Invalid or unknown candidates return `null` and are not persisted.

The normalizer creates stable IDs from scan-scoped typed evidence. It leaves `suggestedFixes` empty; only deterministic proposal generation may attach an applicable repair later in the review workflow.

## Consequences

- Review, storage, and UI code consume one typed finding shape.
- Local models remain advisory and cannot create a finding without deterministic evidence validation.
- Future finding types require a contract update and normalization coverage before they can be persisted or rendered.
