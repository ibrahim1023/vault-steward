---
kind: decision
status: open
rationale: Pilot interviews show that administrators need reassurance about the chosen permissions before inviting colleagues.
updatedAt: 2026-07-16
---

# ADR-005: Show Validation Before Invitations

## Context

The previous onboarding flow asks administrators to invite collaborators before
they see whether the workspace configuration is coherent. In pilot interviews,
that sequence made people worry that they would have to retract invitations
after discovering a mistake.

## Decision

Show the validation report immediately after template selection. The invitation
screen follows only after the administrator has acknowledged warnings or
resolved any blocking configuration errors.

## Consequences

This adds one step to the happy path, but turns the validation report into a
decision aid instead of a post-hoc warning. The product copy must explain that
warnings are recommendations rather than restrictions.
