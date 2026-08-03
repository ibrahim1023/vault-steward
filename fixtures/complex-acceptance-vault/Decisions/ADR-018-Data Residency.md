---
kind: decision
status: proposed
project: Projects/Missing Regional Program.md
relatedDecision: Decisions/ADR-017-Release Criteria.md
updatedAt: 2026-07-18
---

# ADR-018: Data Residency Review

## Context

The regional pilot requires a documented handling path for export files and
support diagnostics.

## Decision

Keep export files in the customer-selected region and retain only redacted
operational metadata in the support workflow.

## Rationale

This keeps the customer data boundary understandable while preserving the
minimum diagnostic information needed for incident follow-up.

## Links

- [[Projects/Atlas Release]]
- [[Decisions/ADR-017-Release Criteria]]

The `project` value intentionally points to a missing note for an existing
decision-field repair candidate.
