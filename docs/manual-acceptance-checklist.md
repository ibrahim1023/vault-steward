# Manual Acceptance Checklist

Use this checklist with
[Manual Acceptance Suite](manual-acceptance-suite.md) and
`fixtures/desktop-acceptance-vault/`. Tick an item only after observing it in
Obsidian desktop.

## Run Record

- [x] New run started
- [x] Obsidian and macOS versions recorded
- [x] Vault Steward version recorded
- [x] Provider and model version recorded
- [x] Fresh-install or upgrade path recorded

| Field          | Value                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Date           | 2026-08-03                                                                                                         |
| Obsidian       | 1.12.7                                                                                                             |
| macOS          | 26.5.2 (25F84)                                                                                                     |
| Vault Steward  | 0.1.0, branch `feat/phase-28-faster-batch-review`, commit `a1a8cbe`                                                |
| Provider/model | HyperFusion `qwen/qwen3-32b`                                                                                       |
| Install path   | Fresh install in disposable complex acceptance vault: `/Users/ibrahim/Documents/Obsidian/complex-acceptance-vault` |

## Installation And Setup

- [x] The package contains `main.js`, `manifest.json`, `styles.css`, and `sql-wasm.wasm`.
- [x] Vault Steward enables without an installation or migration error.
- [x] The ribbon shield and command-palette entry each open one workspace.
- [x] Provider configuration is in Obsidian settings, outside the primary path.
- [ ] Ollama accepts only a loopback endpoint.
- [x] HyperFusion masks the API key, uses no editable endpoint, and requires the cloud-data acknowledgement. (2026-08-04: confirmed in the acceptance vault.)
- [ ] OpenAI masks the API key and requires the cloud-data acknowledgement.
- [x] Reload and disable/re-enable preserve non-secret settings correctly. (2026-08-04: confirmed in the acceptance vault.)

## Simple Review

- [x] The ready state has one dominant action: `Check vault`.
- [x] The default path does not show health scores, counters, filters, confidence, raw evidence, policy, model, maintenance, or observability controls.
- [ ] Scanning shows one progress state and preserves the last successful result.
- [x] A prepared repair shows `Current`, `After`, and an accurate expected result.
- [ ] The preview identifies the source note, locator, exact current/after value, repair kind, and reference target status where applicable.
- [ ] Exact rename candidates are labelled `Verified rename`.
- [x] Model-ranked candidates are labelled `AI suggestion - target exists`.
- [x] `Apply fixes` is the single explicit approval action.
- [ ] Duplicate apply actions are disabled while applying.
- [x] Success reports the actual result and exposes `Review next issue`.
- [x] `View all issues` is secondary.
- [ ] `Settings` and `History` are directly available after the review surface.
- [ ] `Diagnostics` is collapsed and separate from the primary path.

## Finding Coverage

- [x] The broken reference in `Work/Partner Enablement.md` appears.
- [ ] The broken anchor and missing embed in `Research/Customer Interviews.md` appear.
- [ ] The unsupported reference in `Notes/Working Agreement.md` appears.
- [ ] Overdue, orphaned, duplicate, abandoned, completion-pending, and malformed task findings appear.
- [ ] The missing-rationale and explicitly broken decision-association findings appear.
- [ ] Semantic findings cite active-scan evidence and use cautious language.

## Repair And Batch Safety

- [x] The intended Partner Enablement repair changes only the cited wiki link.
- [x] A metadata-confirmed task completion, bounded task field update, and decision field/rationale preview each show the exact Current -> After patch. (2026-08-04: confirmed in the acceptance vault.)
- [x] A compatible mixed task/decision/reference batch applies only after one explicit approval and re-indexes successfully. (2026-08-04: confirmed in the acceptance vault.)
- [x] The expected result matches the validated proposal operations.
- [x] No note changes before `Apply fixes`.
- [x] One click creates an individual approval record for every selected proposal.
- [ ] Every batch member is preflighted before the first write.
- [x] A stale member rejects the entire batch without partial writes. (2026-08-04: edited `Safety/Stale Batch Exercise.md` after preparation; Apply rejected the batch before writing.)
- [ ] Altered, missing, conflicting, or unauthorized proposals fail closed.
- [ ] Same-note operations apply without offset corruption.
- [x] A successful apply re-indexes the vault.
- [x] The actual result matches the changed notes and refreshed findings.
- [ ] Runtime write failure rolls back earlier writes or enters recovery-required state.

## Faster Batch Review And Local Learning

- [x] Prepare at least two compatible fixes; confirm they are grouped by repair family, source folder, and affected notes while each change remains individually selectable.
- [x] Select none and confirm Apply is disabled with a zero-fix expected result; select all and confirm the aggregate result is recalculated.
- [x] Exclude one item and confirm Apply count, resolved-finding count, note count, and unchanged-finding count describe only the remaining selected proposals. (2026-08-04: confirmed in the acceptance vault.)
- [x] Prepare overlapping selected operations in a controlled fixture; confirm the workspace names the conflicting note, disables Apply, and requires one item to be excluded. (2026-08-04: controlled temporary fixture confirmed in the acceptance vault.)
- [x] Confirm a stale, altered, missing, conflicting, or unauthorized selected member still rejects the whole selected batch before its first write. (2026-08-04: stale-member scenario confirmed in the acceptance vault.)
- [x] Dismiss a non-repairable finding with each reason: false positive, expected exception, duplicate report, and revisit later. Confirm the next issue is immediately available. (2026-08-04: confirmed in the acceptance vault.)
- [x] Record three matching false-positive dismissals in a disposable test vault, open Diagnostics > Review preferences, and confirm only then that a reviewed `Suppress from primary review` action appears. (2026-08-04: confirmed in the acceptance vault.)
- [x] Activate that suppression and confirm it only deprioritizes the matching local finding pattern from the primary path. Confirm the finding remains visible through `View all issues` and that scans, evidence, policy evaluation, and writes are unchanged. (2026-08-04: confirmed in the acceptance vault.)
- [x] Confirm local review feedback exposes no note body, prompt, model output, API key, or remote telemetry. (2026-08-04: confirmed in the acceptance vault.)

## Duplicate Entity Consolidation

- [x] A duplicate finding opens a side-by-side review of exactly the two cited notes. (2026-08-04: confirmed in the acceptance vault.)
- [x] The canonical suggestion is clearly advisory; either cited note can be selected by the user. (2026-08-04: confirmed in the acceptance vault.)
- [x] The prepared preview shows every inbound-link and exclusive-alias change with exact Current -> After values. (2026-08-04: confirmed in the acceptance vault.)
- [x] Wiki links, Markdown links, labels, anchors, and embeds are preserved after consolidation. (2026-08-04: confirmed in the acceptance vault.)
- [x] Aliases shared with a third note are not transferred. (2026-08-04: confirmed in the acceptance vault.)
- [x] Applying the batch changes no note body, does not merge or delete notes, and re-indexes successfully. (2026-08-04: confirmed in the acceptance vault.)
- [x] Editing any affected note after preparation causes the entire consolidation batch to fail closed. (2026-08-04: confirmed in the acceptance vault.)

## Judgment Actions

- [x] A non-repairable issue shows one plain-language sentence.
- [x] It exposes one concrete action such as `Open note`, `Review both notes`, or `Not important`.
- [x] The action never creates or applies an unsupported patch.

## Change-Aware Maintenance

- [x] Rename a cited decision or project, run a check, and confirm the affected source note receives a review-only change signal with its exact reference and locator. (2026-08-04: confirmed in the acceptance vault.)
- [x] Mark a decision as superseded, run a check, and confirm a citing plan says it cites a superseded decision. (2026-08-04: confirmed in the acceptance vault.)
- [x] Confirm maintenance signals remain review-only and cannot write a note automatically. (2026-08-04: confirmed in the acceptance vault.)
- [x] Enable the optional schedule, wait for one debounced run while Obsidian remains open, then disable it. Confirm there is no run after the plugin or vault is unavailable. (2026-08-04: confirmed in the acceptance vault.)
- [x] Confirm History shows aggregate recurrence/resolution/dismissal state without note-body telemetry. (2026-08-04: confirmed in the acceptance vault.)

## Settings, History, And Diagnostics

- [x] `Settings` opens provider configuration without exposing controls in the primary path. (2026-08-04: confirmed in the acceptance vault.)
- [x] `History` shows scan and lifecycle metadata without note content. (2026-08-04: confirmed in the acceptance vault.)
- [x] Diagnostics contains only Model connection, Automatic checks, Review preferences, and Local diagnostic data. (2026-08-04: confirmed in the acceptance vault.)
- [x] Model connection reports ready or needs attention without timeout, response-size, prompt, content, or credential details. (2026-08-04: HyperFusion connection check completed.)
- [x] Automatic checks show human-readable status and pause/resume without scan-plan terminology. (2026-08-04: confirmed in the acceptance vault.)
- [x] Review preferences offer suppression only after three explicit matching false-positive dismissals and never show a raw pattern key. (2026-08-04: confirmed in the acceptance vault.)
- [x] Delete diagnostic traces requires confirmation and leaves notes, findings, approvals, feedback, and History unchanged. (2026-08-04: confirmed in the acceptance vault.)
- [x] Two unchanged scans do not multiply persistent findings. (2026-08-04: confirmed in the acceptance vault.)
- [ ] History records resolved and recurring findings.
- [ ] Rename/delete impact does not trigger destructive automatic rewrites.

## Provider Recovery And Privacy

- [x] Stopped Ollama produces exactly one actionable error and preserves the last successful result. (2026-08-04: confirmed with local `qwen3:8b`.)
- [x] Restarting Ollama allows a later `Check vault` to recover. (2026-08-04: confirmed with local `qwen3:8b`.)
- [ ] Missing HyperFusion acknowledgement blocks provider use.
- [ ] Invalid HyperFusion credentials fail without exposing the key.
- [ ] Valid acknowledged HyperFusion configuration can complete a scan and exact-preview flow.
- [ ] Missing OpenAI acknowledgement blocks provider use.
- [ ] Invalid OpenAI credentials fail without exposing the key.
- [ ] Valid acknowledged OpenAI configuration can complete a scan.
- [x] No write occurs after any provider failure. (2026-08-04: confirmed during the Ollama recovery test.)

## Provider Release Reports

- [x] `evals/reports/northstar-ollama.json` passes all release thresholds. (2026-08-05: `qwen3:8b`, 26/26 cases, no incomplete scans or unsafe remediations.)
- [ ] `evals/reports/northstar-hyperfusion.json` passes all provider-validation thresholds before HyperFusion is described as supported.
- [x] `evals/reports/northstar-openai.json` passes all release thresholds. (2026-08-05: `gpt-4o-mini`, 26/26 cases, no incomplete scans or unsafe remediations.)
- [x] Both reports use the same committed corpus fingerprint. (2026-08-05: `d693cc1…81552a0`.)
- [x] `npm run eval:marketplace:gate` passes. (2026-08-05: Ollama and OpenAI reports passed.)
- [x] No report contains an API key, vault excerpt, prompt, raw output, or absolute vault path. (2026-08-05: inspected `northstar-openai.json`.)

## Accessibility And Layout

- [x] Keyboard focus is visible and the tab order follows the main journey. (2026-08-04: confirmed in the acceptance vault.)
- [x] `Enter` and `Space` activate the expected primary action once. (2026-08-04: confirmed in the acceptance vault.)
- [x] VoiceOver announces scan, error, recommendation, applying, and result states once. (2026-08-04: confirmed in the acceptance vault.)
- [x] Current/After content remains readable in narrow and wide panes. (2026-08-04: confirmed in the acceptance vault.)
- [x] Light and dark themes preserve contrast and non-color status meaning. (2026-08-04: confirmed in the acceptance vault.)
- [x] No text, button, or input overlaps or clips. (2026-08-04: confirmed in the acceptance vault.)

## Issues Found

| ID    | Scenario                                                        | Expected                                                                          | Actual                                                                                                                                                                           | Screenshot / notes                                                                                                                                        | Status                      |
| ----- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| UI-01 | HyperFusion `Check vault` on the Phase 28 complex-vault package | Complete the governed scan or show an actionable provider error                   | HyperFusion JSON extraction and normalized-lineage persistence each blocked the first attempts                                                                                   | `Screenshot 2026-08-03 at 16.33.19.png`; fixed build completed scan `scan-62f6a4a9-f272-4350-ae68-f2fbb2e6b620` with 19 findings and 3 prepared proposals | Resolved in manual retest   |
| UI-02 | Scan-to-recommendation progress                                 | Make it clear whether vault scanning or safe-fix preparation is still running     | The 19 persisted issues appeared while the umbrella `Checking vault...` progress continued during bounded repair-ranking calls                                                   | Split into explicit scan and recommendation-preparation states; confirmed in manual retest.                                                               | Resolved in manual retest   |
| UI-03 | Judgment-action layout                                          | Present note navigation and dismissal as one clear, labelled decision flow        | The dismissal-reason select is visually unlabeled and half-width between two competing full-width actions; `Open note` and `Not important` have nearly equal visual weight       | Already patched with a labelled dismissal panel and secondary note action.                                                                                | Awaiting manual retest      |
| UI-04 | Maintenance narrow-pane layout                                  | Group each signal and keep its actions visually attached and consistently sized   | Default bullets, unbounded text, and uneven button wrapping make adjacent maintenance signals run together                                                                       | Superseded: the Maintenance panel was deliberately removed from the v0.1 Diagnostics workspace.                                                           | Resolved by scope reduction |
| FB-01 | Dismissal-reason classification                                 | Only explicit `False positive` feedback counts toward reviewed local suppression  | All four dismissal reasons were persisted with the `false-positive` verdict, so exceptions, duplicates, and revisit-later choices incorrectly advanced the suppression threshold | Manual retest recorded `needs-review` / `revisit-later` feedback after a full Obsidian restart                                                            | Resolved in manual retest   |
| UI-05 | HyperFusion provider label                                      | Distinguish release qualification from an active provider-validation operation    | `HyperFusion (cloud, validation in progress)` reads like a request that is still running, although it is a static release-status label                                           | Changed to `HyperFusion (cloud, experimental)`; confirmed in manual settings retest.                                                                      | Resolved in manual retest   |
| UI-06 | Review-preferences suppression summary                          | The “patterns need review” count reflects only unsuppressed patterns              | After suppressing a pattern from primary review, the summary still reads “8 repeated patterns need review” because it includes suppressed patterns                               | Suppressed patterns are now excluded from the summary; confirmed in manual retest.                                                                        | Resolved in manual retest   |
| UI-07 | Rescan after provider change                                    | Let the user start a new vault check while an existing judgment or result is open | After switching providers, an active judgment screen has no visible `Check vault` or `Check vault again` action; closing and reopening the workspace is required                 | Reported during the 2026-08-04 Ollama recovery test; defer implementation until the current manual test is complete                                       | Open                        |
| UI-08 | OpenAI connection readiness                                     | Recognize a successful OpenAI Responses API readiness response                    | The adapter expected a non-standard top-level `output_text` property instead of `output[].content[].text`, then reported the valid response as unavailable                       | Documented raw-response fixture now passes; live OpenAI retest pending.                                                                                   | Fixed, pending live retest  |

Manual-test note: the nine completed checkboxes in `Work/Launch Control Room.md` were
confirmed as intentional user edits. Revisit-later dismissal created no additional
proposal or plugin-authored note change.

## Sign-off

- [ ] All applicable checks completed
- [ ] No data loss or unintended write observed
- [ ] No blocking install, scan, repair, provider-recovery, or accessibility issue remains
- [ ] The primary path stayed simpler than Settings, History, and Diagnostics
- [ ] Phase 19 is ready to promote to `development`
