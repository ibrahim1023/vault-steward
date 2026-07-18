---
kind: project
status: open
updatedAt: 2026-07-17
tags:
  - product
  - launch
  - northstar
---

# Northstar Launch

Northstar is the first self-service workflow for workspace administrators who
need to onboard a new team without waiting for implementation support. The
launch is deliberately narrow: administrators can create a workspace, import a
starter configuration, invite three initial collaborators, and complete a
guided validation run.

## Outcome

By the end of the launch window, a new administrator should be able to reach a
working first workspace in under fifteen minutes. The primary measure is the
percentage of invited pilot teams who complete setup without a support call.
We will also track time to first successful validation and the number of
configuration resets requested during the first seven days.

## Scope

The first release includes the workspace wizard, role templates, a short
validation report, and an exportable onboarding summary. It does not include
SCIM provisioning, SSO enforcement, bulk import from third-party tools, or
advanced billing administration. Those requests remain in the post-launch
discovery backlog.

## Dependencies

- [[Product/Northstar Brief]] defines the problem and success measures.
- [[Research/Customer Interviews]] records the pilot-team evidence.
- [[Decisions/ADR-004-Launch-window]] records the launch-window decision.
- [[Work/Launch Readiness]] is the operational checklist.
- [[Work/Partner Enablement]] contains the partner handoff plan.

## Risks

The wizard could be technically complete but still fail because administrators
do not understand the permission model. Support capacity is also limited during
the first week, so unclear onboarding copy is a product risk rather than merely
a documentation issue.

## Review cadence

The delivery group reviews launch readiness every Tuesday and Thursday. Open
risks are summarized in the decision log; completed work is linked from the
readiness checklist.
