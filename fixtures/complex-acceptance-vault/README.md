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
  malformed, completion-pending, and bounded due-date tasks.
- `Decisions/ADR-017-Release Criteria.md`: a decision missing a rationale.
- `Decisions/ADR-018-Data Residency.md`: a decision with a broken existing
  project field and a valid replacement candidate.

## Review-Only Cases

- `Notes/Operating Model.md`: an unsupported local-file target.
- `Work/Customer Handoff.md`: an ambiguous bare Launch link, because both
  `Plans/Launch.md` and `Archive/Launch.md` exist.
- `People/Maya Chen.md` and `People/Maya C.md`: a duplicate-entity pair for
  side-by-side canonical review. `Work/Stakeholder Directory.md` contains a
  labelled wiki link, anchored embed, and encoded Markdown link for previewing
  a consolidation; neither source note should be deleted.
- `Product/Aurora Brief.md` and `Research/Usage Signals.md`: a deliberately
  conflicting launch-window claim for evidence-backed semantic review.

Open a disposable copy in Obsidian, install the packaged plugin, select a
provider, and choose **Check vault**. Do not expect every model to produce the
same semantic recommendation. Deterministic reference, task, and decision
findings should remain stable.

`Policies/Atlas Conventions.yaml` is a policy-template draft. Use Policy Studio
to preview it before explicitly saving it as the active policy. It is not
activated merely by opening this vault.
