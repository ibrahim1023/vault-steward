# Manual Acceptance Checklist

Use this checklist with [Manual Acceptance Suite](manual-acceptance-suite.md)
and `fixtures/desktop-acceptance-vault/`. Tick a box only after the stated
outcome is observed in the Obsidian desktop application. Leave a failed item
unchecked and add its screenshot and reproduction details below the relevant
section.

## Run Record

- [ ] New run started
- [ ] Obsidian version recorded
- [ ] Operating system/version recorded
- [ ] Vault Steward version recorded
- [ ] Local model name and version recorded
- [ ] Fresh installation or upgrade path recorded

| Field | Value |
| --- | --- |
| Date | |
| Obsidian | |
| Operating system | |
| Vault Steward | |
| Local model | |
| Install path | |

## Installation And Readiness

- [ ] The packaged plugin folder contains `main.js`, `manifest.json`, `styles.css`, and `sql-wasm.wasm`.
- [ ] Vault Steward can be enabled from Community Plugins in the test vault.
- [ ] The left-ribbon shield icon appears once.
- [ ] The `Open Vault Steward status` command-palette command opens the workspace.
- [ ] The configured local-model endpoint is loopback-only and points to the running provider.
- [ ] `Check local model` reports readiness before the first scan.

## Baseline Scan

- [ ] A baseline scan completes without a vault-access, database, or model error.
- [ ] The dashboard has a clear ready state and does not duplicate status text.
- [ ] Vault health counts are readable and match the visible priority findings.
- [ ] The broken reference in `Work/Partner Enablement.md` appears.
- [ ] The broken anchor in `Research/Customer Interviews.md` appears.
- [ ] The missing embed in `Research/Customer Interviews.md` appears.
- [ ] The unsupported reference in `Notes/Working Agreement.md` appears.
- [ ] The overdue task in `Work/Launch Readiness.md` appears.
- [ ] The orphaned task in `Work/Launch Readiness.md` appears.
- [ ] The duplicate task in `Work/Launch Readiness.md` appears.
- [ ] The abandoned task in `Work/Launch Readiness.md` appears.
- [ ] The malformed task in `Work/Launch Readiness.md` appears.
- [ ] The missing-rationale decision in `Decisions/ADR-004-Launch-window.md` appears.
- [ ] Finding titles, severity, evidence paths, and explanations are understandable without source-code knowledge.
- [ ] Any semantic findings are evidence-backed and appropriately cautious.

## Finding Navigation And Detail

- [ ] Clicking a priority finding changes the selected detail only.
- [ ] The selected broken reference exposes a reference-repair action.
- [ ] A selected task, policy, or decision finding does not display a misleading repair control.
- [ ] Non-repairable findings clearly state that no safe automatic fix is available.
- [ ] Evidence paths and line references fit the sidebar without confusing truncation.
- [ ] The next best action is understandable and leads to the intended finding.

## Safe Reference Repair

- [ ] `Work/Partner Enablement.md` is selected as the repair source.
- [ ] `Guides/Partner Onboarding Checklist` is accepted as the replacement target.
- [ ] Preparing a repair produces a proposal and readable diff preview.
- [ ] The diff changes only `[[Guides/Partner Migration Checklist]]`.
- [ ] Approval is explicit and does not write the source note.
- [ ] Applying an approved change updates the source note.
- [ ] A later scan resolves the repaired finding without hiding unrelated findings.
- [ ] A proposal becomes stale when its source note changes before apply.
- [ ] A stale proposal does not overwrite the newer source note.

## Evidence Explanation And Feedback

- [ ] `Explain evidence` opens only for the selected finding.
- [ ] The local-model explanation is grounded in the cited evidence.
- [ ] The explanation view has a clear loading, success, and failure state.
- [ ] A `Useful` verdict can be saved.
- [ ] A `False positive` verdict can be saved.
- [ ] A `Needs review` verdict can be saved.
- [ ] Feedback labels do not expose raw note content elsewhere in the workspace.

## Policy Studio

- [ ] The active policy YAML loads into Policy Studio.
- [ ] The supplied Northstar policy previews an owner violation.
- [ ] The supplied Northstar policy previews a missing-rationale violation.
- [ ] The preview count is clear and does not alter the scan automatically.
- [ ] Saving the valid policy shows a success state.
- [ ] A later scan shows policy findings with rule and source context.
- [ ] Invalid YAML displays useful diagnostics.
- [ ] Invalid YAML cannot be saved.
- [ ] Restoring valid YAML recovers the Policy Studio state.

## History, Lifecycle, And Observability

- [ ] Running a second unchanged scan does not multiply persistent findings.
- [ ] A fixed decision becomes resolved only after a later completed scan.
- [ ] Restoring a defect records a recurrence after the next completed scan.
- [ ] History lists scans in a readable order.
- [ ] Scan and finding lifecycle metadata remains legible in a narrow sidebar.
- [ ] Observability opens and allows selecting a completed scan.
- [ ] Agent timeline, finding lineage, and configuration fingerprint are visible.
- [ ] Observability does not reveal raw note bodies, prompts, or unredacted model output.
- [ ] Deleting one scan trace removes only that trace.
- [ ] Deleting all trace data requires deliberate confirmation and leaves the workspace usable.

## Maintenance And Change Impact

- [ ] Maintenance groups related findings in a readable queue.
- [ ] `Projects/Northstar Launch.md` produces coherent impact results.
- [ ] `Work/Launch Readiness.md` produces coherent impact results.
- [ ] `Decisions/ADR-004-Launch-window.md` produces coherent impact results.
- [ ] Rename impact identifies inbound exact wiki links.
- [ ] Delete impact reports affected references without destructive rewrites.
- [ ] Maintenance controls remain understandable at narrow sidebar width.
- [ ] Scheduled maintenance starts disabled unless explicitly enabled.
- [ ] Pause/resume state is visible and changes only after an explicit action.

## Failure Recovery And Privacy

- [ ] With the local model stopped, scan failure shows exactly one clear message.
- [ ] The last successful findings remain visible after a failed scan.
- [ ] Starting the local model and passing readiness allows a later scan to recover.
- [ ] Trace preferences default to metadata-only storage.
- [ ] Prompt/model-output snapshots remain disabled unless explicitly enabled.
- [ ] Changing retention preferences is reflected after closing and reopening settings.

## Keyboard And Responsive Use

- [ ] Ribbon and command-palette entry points work.
- [ ] Keyboard focus remains visible for every interactive control.
- [ ] `Tab`, `Shift+Tab`, `Enter`, and `Space` work through the main review flow.
- [ ] Collapsible sections work by keyboard.
- [ ] Error messages are announced once, not duplicated.
- [ ] No important text, button, or input is clipped in the narrow sidebar.
- [ ] No section has excessive spacing or unclear hierarchy.

## Issues Found

| ID | Scenario | Expected | Actual | Screenshot / notes | Status |
| --- | --- | --- | --- | --- | --- |
| UI-01 | | | | | Open |
| UI-02 | | | | | Open |
| UI-03 | | | | | Open |

## Sign-off

- [ ] All applicable checks completed
- [ ] No critical data-loss or unintended-write behavior observed
- [ ] No unresolved blocking installation, scan, repair, or model-recovery issue remains
- [ ] UI issues have been captured with reproduction details
