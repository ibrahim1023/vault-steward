# Atlas Release Operations

This is a synthetic, disposable Obsidian vault for exercising Vault Steward on
a more realistic product launch workspace. It contains intentional defects and
is not a reference for operational decisions.

## Safe Repair Candidates

- `Work/Partner Enablement.md`: a missing wiki target with the existing
  `Guides/Partner Onboarding Checklist.md` as the intended candidate.
- `Work/Escalation Drill.md`: a broken heading anchor whose target note contains
  the intended heading.
- `Research/Interview Synthesis.md`: a broken block anchor with a matching
  block target in `Research/Customer Discovery.md`.
- `Work/Launch Control Room.md`: overdue, orphaned, duplicate, abandoned,
  malformed, and completion-pending tasks.
- `Decisions/ADR-017-Release Criteria.md`: a decision missing a rationale.

## Review-Only Cases

- `Notes/Operating Model.md`: an unsupported local-file target.
- `Work/Customer Handoff.md`: an ambiguous bare Launch link, because both
  `Plans/Launch.md` and `Archive/Launch.md` exist.
- `People/Maya Chen.md` and `People/Maya C.md`: a duplicate-entity pair for
  side-by-side canonical review; neither source note should be deleted.
- `Product/Aurora Brief.md` and `Research/Usage Signals.md`: a deliberately
  conflicting launch-window claim for evidence-backed semantic review.

Open a disposable copy in Obsidian, install the packaged plugin, select a
provider, and choose **Check vault**. Do not expect every model to produce the
same semantic recommendation. Deterministic reference, task, and decision
findings should remain stable.
