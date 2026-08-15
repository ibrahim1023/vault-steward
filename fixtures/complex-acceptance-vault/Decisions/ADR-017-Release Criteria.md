---
kind: decision
status: accepted
project: Projects/Atlas Release.md
updatedAt: 2026-07-29
---

# ADR-017: Release Criteria

## Context

Regional operators need a consistent standard for deciding whether a role
import is safe enough for the initial cohort. The standard must make failure
handling visible before an import reaches production.

## Decision

Permit cohort expansion only when the prior seven days contain no unresolved
critical import incident and at least ninety percent of imports complete with a
reviewed audit record.

## Consequences

The criterion may delay the second cohort, but it prevents the team from
normalizing support-assisted imports as self-service success.

## Links

- [[Projects/Atlas Release]]
- [[Work/Launch Control Room]]

The frontmatter intentionally omits `rationale` for decision-quality and
bounded rationale-repair testing.
