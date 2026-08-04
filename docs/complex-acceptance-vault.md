# Complex Acceptance Vault Guide

`fixtures/complex-acceptance-vault/` is a disposable, synthetic Obsidian vault
for exercising Vault Steward beyond the compact Northstar release corpus. Copy
the directory before opening it in Obsidian: several scenarios intentionally
change source notes or require reset after a repair.

It is not a benchmark and does not alter release-quality claims. The compact
Northstar fixture remains the release reference workflow. This vault supplies
realistic, connected notes for a broader manual inspection of the product.

## Use It Safely

1. Copy `fixtures/complex-acceptance-vault/` outside this repository and open
   the copy as an Obsidian vault.
2. Install the package built from the branch under test into that copy.
3. Run **Check vault**, review the prepared recommendation, and reset the copy
   before repeating a scenario that writes or renames a note.
4. Record only paths, finding types, expected behavior, actual behavior, and
   screenshots in the manual checklist. Do not publish vault content or keys.

## Content-Driven Coverage

| Acceptance area                  | Notes to use                                                                                                                                                                      | Expected behavior                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prepared wiki repair             | `Work/Partner Enablement.md`                                                                                                                                                      | The retired `Partner Migration Playbook` wiki link can be replaced with the existing `Guides/Partner Onboarding Checklist` target after an exact preview and approval.                                                       |
| Prepared Markdown repair         | `Work/Partner Enablement.md`                                                                                                                                                      | The percent-encoded relative Markdown link is broken and exercises source-relative path handling. A repair must preserve the visible label.                                                                                  |
| Heading-anchor repair            | `Work/Escalation Drill.md` and `Runbooks/Production Escalation Guide.md`                                                                                                          | The target note exists but the cited heading is missing. The product may offer only a bounded existing heading candidate or abstain.                                                                                         |
| Block-anchor/embed repair        | `Research/Interview Synthesis.md` and `Research/Customer Discovery.md`                                                                                                            | The target exists but its block reference is missing. A prepared result must preserve embed syntax and use an existing block ID only.                                                                                        |
| Ambiguous reference              | `Work/Customer Handoff.md`, `Plans/Launch.md`, and `Archive/Launch.md`                                                                                                            | The bare `Launch` destination is ambiguous and stays review-only; no automatic target is prepared.                                                                                                                           |
| Unsupported external reference   | `Notes/Operating Model.md`                                                                                                                                                        | The `file:` target is reported as unsupported and never becomes a repair proposal.                                                                                                                                           |
| Task integrity                   | `Work/Launch Control Room.md`                                                                                                                                                     | The scan finds overdue, orphaned, duplicate, abandoned, malformed, completion-pending, and bounded due-date task cases. Completion requires the explicit `status: done` signal; due-date candidates remain snapshot-derived. |
| Decision integrity               | `Decisions/ADR-017-Release Criteria.md` and `Decisions/ADR-018-Data Residency.md`                                                                                                 | One decision lacks rationale; another has a broken project association. Any proposal changes only a validated frontmatter field or constrained rationale.                                                                    |
| Duplicate-entity review          | `People/Maya Chen.md`, `People/Maya C.md`, and `Work/Stakeholder Directory.md`                                                                                                    | Review canonical selection without merging or deleting notes. The preview must retain the visible `Maya` label, embed anchor, and encoded Markdown path.                                                                     |
| Policy/template preview          | `Policies/Atlas Conventions.yaml`, `Projects/Signal Expansion.md`, `Tasks/Regional Follow-ups.md`, `Meetings/2026-08-12 Release Review.md`, and `Research/Interview Synthesis.md` | Paste the policy draft into Policy Studio and preview before saving. It should expose missing fields in the named typed notes; it must not activate merely because the YAML is present in the vault.                         |
| Evidence-backed semantic review  | `Product/Aurora Brief.md` and `Research/Usage Signals.md`                                                                                                                         | The notes contain incompatible public-launch dates. Model-dependent semantic output may vary, but any finding must cite the active snapshot evidence and remain review-only.                                                 |
| Rename impact                    | `Guides/Partner Onboarding Checklist.md` and `Work/Launch Control Room.md`                                                                                                        | Rename a disposable copy of the guide and inspect inbound link impact. Confirm that link labels and anchors are preserved in any preview.                                                                                    |
| Delete impact                    | `Runbooks/Production Escalation Guide.md` or `Research/Customer Discovery.md`                                                                                                     | Delete a disposable copy of a cited target, scan again, and verify the impact is reported without an automatic destructive rewrite.                                                                                          |
| Stale-batch protection           | Any prepared repair source, preferably `Work/Partner Enablement.md`                                                                                                               | Prepare a fix, manually edit the source note before applying, and verify the whole batch rejects before writing. Reset, repeat, then confirm post-apply re-indexing.                                                         |
| Controlled stale-batch exercise  | `Safety/Legacy Escalation Guide.md` and `Safety/Stale Batch Exercise.md`                                                                                                          | Rename the guide to `Safety/Current Escalation Guide.md`, prepare the verified rename repair, then edit the exercise note before Apply. The batch must reject without changing either note.                                  |
| Repeated dismissal and lifecycle | Any review-only issue, preferably `Work/Customer Handoff.md`                                                                                                                      | Mark an issue unimportant repeatedly, advance through the remaining review items, rescan, and inspect lifecycle/history behavior without multiplying unchanged findings.                                                     |

## App-Level Release Checks

Some manual-acceptance-suite rows cannot be represented by Markdown notes.
Run them against this vault or the Northstar fixture after the content scenarios:

- fresh install, upgrade, reload, disable/re-enable, and package-install smoke;
- provider selection, readiness, Ollama failure/recovery, and any acknowledged
  remote-provider failure/recovery;
- no-write-without-approval, apply progress, failure messaging, and recovery;
- narrow and full panes, keyboard-only navigation, light/dark themes, and
  VoiceOver;
- settings, history, diagnostics, observability redaction, and retention;
- scan recurrence, re-indexing, policy save/invalid-YAML rejection, and
  maintenance impact.

Mark the release checklist complete only after the current `development`
package passes the designated Northstar macOS run. This vault helps discover
workflow defects; it does not substitute for that release gate.
