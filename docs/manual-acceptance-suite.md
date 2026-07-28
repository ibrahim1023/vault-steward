# Manual Acceptance Suite

Use the folder at `fixtures/desktop-acceptance-vault/` to test Vault Steward
with realistic material. Create a new Obsidian vault named `Northstar Acceptance`,
copy the folder contents into its root, install the current packaged plugin, and
keep an untouched copy for reset. The suite intentionally includes known defects;
its value is in whether Vault Steward makes those defects understandable and
safe to act on.

Track the run in [manual-acceptance-checklist.md](manual-acceptance-checklist.md).

## Setup

1. Build and package the plugin with `npm run package:plugin`.
2. Copy `dist/vault-steward/` to
   `<Northstar Acceptance>/.obsidian/plugins/vault-steward/`.
3. Enable Vault Steward and configure either a loopback local model endpoint or
   the OpenAI provider. For OpenAI, enter the API key and enable the cloud-data
   acknowledgement before a scan.
4. Open Vault Steward from the left-ribbon shield icon and run **Check
   readiness** before the first scan.

Record the Obsidian version, macOS/Windows/Linux version, model provider/model
name, and whether the plugin was freshly installed or upgraded. A failed model
readiness check is a setup failure, not a finding-quality result.

## First Review Flow

Run a scan without editing any fixture. It must complete and render a usable
focused review interface. Follow this first-run flow before opening advanced
tools:

```text
Run scan -> inspect health -> select one of the top three -> review detail ->
expand View all findings -> open More only for readiness/policy/maintenance/history/observability.
```

Confirm the health summary is readable and the compact queue initially exposes
only the top three ranked findings. Select one of those findings and verify that
only the selected detail changes. The selected row and detail use the teal
selection treatment, while the visible severity label communicates severity
without relying on its color. Select **View all findings**, then use the
severity filter and finding search to narrow the expanded queue before choosing
another result.

Open **More** only after the focused review flow. It must reveal readiness,
policy, maintenance, history, and observability tools without displacing the
queue or detail before it is opened. Confirm that the workbench stacks the
queue above the selected detail at a narrow sidebar width and that no controls
or source paths are clipped.

Confirm that the queue contains findings covering:

- the broken reference in `Work/Partner Enablement.md`;
- the broken anchor and missing embed in `Research/Customer Interviews.md`;
- the unsupported target in `Notes/Working Agreement.md`;
- overdue, orphaned, duplicated, abandoned, and malformed tasks in
  `Work/Launch Readiness.md`; and
- the missing rationale in `Decisions/ADR-004-Launch-window.md`.

The semantic-analysis stage may add evidence-backed entity, contradiction,
staleness, or decision findings. Treat those as review candidates rather than
fixed-count assertions: model output can vary by provider, model, and hardware.

For each result, assess whether the title, severity label, evidence path, line
number, and plain-language explanation make sense without opening source code.
Note anything that requires excessive scrolling, truncates a path, duplicates
status text, or hides the next action.

## Review And Repair

1. Select the `Work/Partner Enablement.md` broken-reference finding, not one of
   the other reference errors.
2. Select **Review repair**. The target input and preparation control must stay
   hidden until this explicit action.
3. In **Reference target**, enter `Guides/Partner Onboarding Checklist`.
4. Select **Prepare reference repair** and inspect the diff. It should replace
   only `[[Guides/Partner Migration Checklist]]`.
5. Approve and apply the proposal. Confirm that the note changes only after
   approval and that the success state is visible.
6. Run another scan. The repaired finding should resolve while unrelated
   findings remain.

### Stale-proposal protection

Reset the fixture, prepare the same proposal, then edit the source line in
`Work/Partner Enablement.md` before applying. Applying must reject the proposal
as stale and must not overwrite the newer note text.

## Finding Detail And Feedback

Select an overdue task, a missing-rationale decision, and a broken reference in
turn. For each, verify that selection updates only the detail surface; it must
not trigger a repair or change status. Non-reference findings should state that
no safe automatic fix is available.

Expand **Explain evidence** with the selected provider available. The explanation must refer only
to the cited source evidence, be understandable in the sidebar, and fail
cleanly if the model is unavailable. Use **Review feedback** to record one
`Useful`, one `False positive`, and one `Needs review` verdict. Check that labels
are optional, bounded, and do not expose note contents elsewhere in the UI.

## Policy Studio

After a completed scan, paste this policy into **Policy Studio**:

```yaml
id: northstar-acceptance
version: 1
enabled: true
rules:
  - id: project-owner
    fact: project.owner
    operator: required
    severity: high
  - id: decision-rationale
    fact: decision.rationale
    operator: required
    severity: medium
```

Select **Preview policy**. It should report violations for the ownerless
Northstar project and ADR-004. Save it, scan again, and confirm policy findings
identify the rule and source. Then make the YAML invalid, preview it, and verify
that diagnostics are clear and saving is blocked. Restore the valid policy at
the end.

## History, Lifecycle, And Observability

Run two successful scans without changes. Findings should not multiply merely
because another scan occurred. Then complete these state changes one at a time:

1. Add a rationale to `Decisions/ADR-004-Launch-window.md`.
2. Fix or remove the malformed task in `Work/Launch Readiness.md`.
3. Run a scan after each edit.

Open **More**, then open **History** and verify that prior scans remain visible, the relevant
findings become resolved only after a later completed scan, and recurrence is
shown if you restore a defect and scan again.

Open **Observability** from **More**. Switch between two scans, inspect the agent timeline,
finding lineage, and the configuration fingerprint. Confirm that this view
shows metadata and evidence locators rather than raw note bodies or model
prompts. Test deletion of one scan trace, then use a fresh scan before testing
the destructive **Delete all trace data** control.

## Maintenance And Impact

Open **More**, then open **Maintenance**. Ensure the grouped queue is legible and does not overflow
the sidebar. Enter these paths exactly, one at a time:

- `Projects/Northstar Launch.md`
- `Work/Launch Readiness.md`
- `Decisions/ADR-004-Launch-window.md`

Select **Inspect impact** and check that the counts and labels are coherent.
For rename impact, rename `Product/Northstar Brief.md` to
`Product/Northstar Launch Brief.md` in Obsidian, run a scan, and inspect impact
for `Product/Northstar Brief.md`. The exact wiki links may be eligible for a
safe rewrite, but embeds, Markdown links, aliases, and deletions must remain
review-only. Undo the rename when finished.

## Reliability And Accessibility

With the selected model provider unavailable, run a scan and confirm that exactly one clear
failure message appears while the most recent successful findings remain visible.
Restore the provider, use **Check readiness**, and confirm recovery with a successful scan.

Repeat the main flow with keyboard only: ribbon/command palette opening, Run
scan, selecting a priority finding, expanding disclosures, entering a repair
target, previewing a policy, inspecting impact, and opening history. At the
sidebar's narrowest practical width, record clipped text, controls that wrap
poorly, unclear hierarchy, duplicated headings, excessive vertical spacing, and
actions that are separated from the information needed to make a decision.

## Report Back

For every UI problem, provide a screenshot plus these four details:

1. What you were trying to do.
2. The selected finding or note path.
3. What you expected.
4. What occurred instead.

That turns visual feedback into a reproducible product issue rather than a
general impression.
