# Manual Acceptance Checklist

Use this checklist with
[Manual Acceptance Suite](manual-acceptance-suite.md) and
`fixtures/desktop-acceptance-vault/`. Tick an item only after observing it in
Obsidian desktop.

## Run Record

- [ ] New run started
- [ ] Obsidian and macOS versions recorded
- [ ] Vault Steward version recorded
- [ ] Provider and model version recorded
- [ ] Fresh-install or upgrade path recorded

| Field          | Value |
| -------------- | ----- |
| Date           |       |
| Obsidian       |       |
| macOS          |       |
| Vault Steward  |       |
| Provider/model |       |
| Install path   |       |

## Installation And Setup

- [ ] The package contains `main.js`, `manifest.json`, `styles.css`, and `sql-wasm.wasm`.
- [ ] Vault Steward enables without an installation or migration error.
- [ ] The ribbon shield and command-palette entry each open one workspace.
- [ ] Provider configuration is in Obsidian settings, outside the primary path.
- [ ] Ollama accepts only a loopback endpoint.
- [ ] HyperFusion masks the API key, uses no editable endpoint, and requires the cloud-data acknowledgement.
- [ ] OpenAI masks the API key and requires the cloud-data acknowledgement.
- [ ] Reload and disable/re-enable preserve non-secret settings correctly.

## Simple Review

- [ ] The ready state has one dominant action: `Check vault`.
- [ ] The default path does not show health scores, counters, filters, confidence, raw evidence, policy, model, maintenance, or observability controls.
- [ ] Scanning shows one progress state and preserves the last successful result.
- [ ] A prepared repair shows `Current`, `After`, and an accurate expected result.
- [ ] The preview identifies the source note, locator, exact current/after value, repair kind, and reference target status where applicable.
- [ ] Exact rename candidates are labelled `Verified rename`.
- [ ] Model-ranked candidates are labelled `AI suggestion - target exists`.
- [ ] `Apply fixes` is the single explicit approval action.
- [ ] Duplicate apply actions are disabled while applying.
- [ ] Success reports the actual result and exposes `Review next issue`.
- [ ] `View all issues` is secondary.
- [ ] `Settings` and `History` are directly available after the review surface.
- [ ] `Diagnostics` is collapsed and separate from the primary path.

## Finding Coverage

- [ ] The broken reference in `Work/Partner Enablement.md` appears.
- [ ] The broken anchor and missing embed in `Research/Customer Interviews.md` appear.
- [ ] The unsupported reference in `Notes/Working Agreement.md` appears.
- [ ] Overdue, orphaned, duplicate, abandoned, completion-pending, and malformed task findings appear.
- [ ] The missing-rationale and explicitly broken decision-association findings appear.
- [ ] Semantic findings cite active-scan evidence and use cautious language.

## Repair And Batch Safety

- [ ] The intended Partner Enablement repair changes only the cited wiki link.
- [ ] A metadata-confirmed task completion, bounded task field update, and decision field/rationale preview each show the exact Current -> After patch.
- [ ] A compatible mixed task/decision/reference batch applies only after one explicit approval and re-indexes successfully.
- [ ] The expected result matches the validated proposal operations.
- [ ] No note changes before `Apply fixes`.
- [ ] One click creates an individual approval record for every selected proposal.
- [ ] Every batch member is preflighted before the first write.
- [ ] A stale member rejects the entire batch without partial writes.
- [ ] Altered, missing, conflicting, or unauthorized proposals fail closed.
- [ ] Same-note operations apply without offset corruption.
- [ ] A successful apply re-indexes the vault.
- [ ] The actual result matches the changed notes and refreshed findings.
- [ ] Runtime write failure rolls back earlier writes or enters recovery-required state.

## Duplicate Entity Consolidation

- [ ] A duplicate finding opens a side-by-side review of exactly the two cited notes.
- [ ] The canonical suggestion is clearly advisory; either cited note can be selected by the user.
- [ ] The prepared preview shows every inbound-link and exclusive-alias change with exact Current -> After values.
- [ ] Wiki links, Markdown links, labels, anchors, and embeds are preserved after consolidation.
- [ ] Aliases shared with a third note are not transferred.
- [ ] Applying the batch changes no note body, does not merge or delete notes, and re-indexes successfully.
- [ ] Editing any affected note after preparation causes the entire consolidation batch to fail closed.

## Judgment Actions

- [ ] A non-repairable issue shows one plain-language sentence.
- [ ] It exposes one concrete action such as `Open note`, `Review both notes`, or `Not important`.
- [ ] The action never creates or applies an unsupported patch.

## Change-Aware Maintenance

- [ ] Rename a cited decision or project, run a check, and confirm the affected source note receives a review-only change signal with its exact reference and locator.
- [ ] Mark a decision as superseded, run a check, and confirm a citing plan says it cites a superseded decision.
- [ ] Confirm maintenance actions can open the cited note, review related notes, and dismiss the signal, but cannot write a note automatically.
- [ ] Make one Markdown modification and inspect Diagnostics > Maintenance schedule for `changed notes reused`; rename, delete, create, or an ambiguous event must report `full vault check`.
- [ ] Enable the optional schedule, wait for one debounced run while Obsidian remains open, then disable it. Confirm there is no run after the plugin or vault is unavailable.
- [ ] Confirm History shows aggregate recurrence/resolution/dismissal state without note-body telemetry.

## Settings, History, And Diagnostics

- [ ] `Settings` opens provider configuration without exposing controls in the primary path.
- [ ] `History` shows scan and lifecycle metadata without note content.
- [ ] Policy Studio, readiness, maintenance, impact inspection, observability, retention, and stored-data controls are reachable under `Diagnostics`.
- [ ] Two unchanged scans do not multiply persistent findings.
- [ ] History records resolved and recurring findings.
- [ ] Invalid policy YAML cannot be saved.
- [ ] Rename/delete impact does not trigger destructive automatic rewrites.
- [ ] Observability excludes note bodies, prompts, API keys, and raw model output by default.

## Provider Recovery And Privacy

- [ ] Stopped Ollama produces exactly one actionable error and preserves the last successful result.
- [ ] Restarting Ollama allows a later `Check vault` to recover.
- [ ] Missing HyperFusion acknowledgement blocks provider use.
- [ ] Invalid HyperFusion credentials fail without exposing the key.
- [ ] Valid acknowledged HyperFusion configuration can complete a scan and exact-preview flow.
- [ ] Missing OpenAI acknowledgement blocks provider use.
- [ ] Invalid OpenAI credentials fail without exposing the key.
- [ ] Valid acknowledged OpenAI configuration can complete a scan.
- [ ] No write occurs after any provider failure.

## Provider Release Reports

- [ ] `evals/reports/northstar-ollama.json` passes all release thresholds.
- [ ] `evals/reports/northstar-hyperfusion.json` passes all provider-validation thresholds before HyperFusion is described as supported.
- [ ] `evals/reports/northstar-openai.json` passes all release thresholds.
- [ ] Both reports use the same committed corpus fingerprint.
- [ ] `npm run eval:marketplace:gate` passes.
- [ ] No report contains an API key, vault excerpt, prompt, raw output, or absolute vault path.

## Accessibility And Layout

- [ ] Keyboard focus is visible and the tab order follows the main journey.
- [ ] `Enter` and `Space` activate the expected primary action once.
- [ ] VoiceOver announces scan, error, recommendation, applying, and result states once.
- [ ] Current/After content remains readable in narrow and wide panes.
- [ ] Light and dark themes preserve contrast and non-color status meaning.
- [ ] No text, button, or input overlaps or clips.

## Issues Found

| ID    | Scenario | Expected | Actual | Screenshot / notes | Status |
| ----- | -------- | -------- | ------ | ------------------ | ------ |
| UI-01 |          |          |        |                    | Open   |
| UI-02 |          |          |        |                    | Open   |
| UI-03 |          |          |        |                    | Open   |

## Sign-off

- [ ] All applicable checks completed
- [ ] No data loss or unintended write observed
- [ ] No blocking install, scan, repair, provider-recovery, or accessibility issue remains
- [ ] The primary path stayed simpler than Settings, History, and Diagnostics
- [ ] Phase 19 is ready to promote to `development`
