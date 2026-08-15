---
kind: work-plan
status: open
updatedAt: 2026-07-17
---

# Launch Readiness

This checklist is used in the Tuesday and Thursday delivery reviews. It is
intended to answer one question: can a pilot administrator complete setup and
receive support without the team relying on tribal knowledge?

## Product and engineering

- [x] Publish the permission-template copy owner:maya project:Projects/Northstar Launch.md due:2026-07-10 ^permission-copy
- [ ] Validate the guided setup analytics events owner:lee project:Projects/Northstar Launch.md due:2026-07-12 ^analytics-events
- [ ] Confirm the support escalation rota project:Projects/Northstar Launch.md due:2026-07-25 ^rota
- [ ] Check the staging migration owner:lee project:Projects/Northstar Launch.md due:2026-07-25 ^duplicate-check
- [ ] Check the production migration owner:lee project:Projects/Northstar Launch.md due:2026-07-25 ^duplicate-check
- [ ] Archive the deprecated questionnaire owner:maya project:Projects/Northstar Launch.md abandoned:true ^archive-questionnaire
- [ ] Review the launch checklist owner:maya project:Projects/Northstar Launch.md due:not-a-date ^bad-date

## Customer success

The support team will use the workspace summary in the first call. They should
not ask the administrator to repeat choices already captured by the wizard. The
handoff script is maintained in [[Work/Partner Enablement]].

## Release criteria

The cohort should not be expanded when validation errors exceed five percent of
new workspaces, or when more than two pilot teams need a manual permission
correction. The delivery lead records exceptions in a decision note.
