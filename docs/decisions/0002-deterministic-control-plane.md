# ADR: Deterministic Control Plane for Model-Assisted Findings

## Status

Accepted for the foundation.

## Context

The product needs local models for ambiguous semantic judgments but must remain evidence-first, policy-governed, and approval-only for mutation.

## Decision

Models return bounded, typed candidates. Deterministic code owns parsing, policy enforcement, validation, evidence resolution, severity, approval, patch generation, and apply.

## Alternatives considered

- Fully autonomous tool-using agents
- Prompt-only policy enforcement
- Deterministic-only product

## Reasons

This preserves semantic assistance while making security and product guarantees enforceable and testable.

## Tradeoffs

More integration code and conservative false negatives are accepted in exchange for safer behavior.

## Consequences

Every agent output requires a schema, validator, evidence references, budgets, traces, and evaluation coverage.

## Migration or reversal strategy

Agent roles can become deterministic over time. New model capabilities must enter through the same candidate contract and evaluation gates.
