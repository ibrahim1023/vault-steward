---
kind: decision
status: open
updatedAt: 2026-07-14
---

# ADR-004: Launch Window

## Context

The pilot cohort is ready to begin in late July. Customer-success coverage is
available for the first week of August, while the engineering team has a
separate reliability release planned for the middle of the month. A launch that
overlaps the reliability release would make it harder to distinguish product
feedback from platform regressions.

## Decision

Open the Northstar pilot on 2026-07-29 and admit no more than ten workspaces in
the first wave. Expand only after the Tuesday review shows that setup completion
and validation-report errors are within the agreed thresholds.

## Consequences

The constrained cohort gives customer success room to observe onboarding calls
and gives product a smaller, more interpretable evidence set. It delays broad
availability, but prevents a temporary support spike from being mistaken for
normal launch demand.

## Links

- [[Projects/Northstar Launch]]
- [[Work/Launch Readiness]]
