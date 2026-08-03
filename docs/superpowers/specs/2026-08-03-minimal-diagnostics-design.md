# Minimal Diagnostics Design

**Date:** 2026-08-03

**Status:** Approved mockup

**Scope:** Simplify the user-visible Diagnostics surface without weakening Vault
Steward's local-first audit, policy, approval, or trace-retention behavior.

## Objective

Diagnostics should help a normal user answer four questions:

1. Can Vault Steward reach the selected model?
2. Are automatic checks running?
3. Has repeated local feedback produced a suppression choice?
4. How can locally stored diagnostic traces be deleted?

It must not expose developer dashboards, prompt metadata, internal identifiers,
or evaluation tooling in the Obsidian workspace.

## User Experience

Keep one collapsed `Diagnostics` disclosure below Settings and History. When
opened, it contains four compact sections in this order.

### Model connection

- Label the action `Check connection`.
- While checking, show one concise progress state.
- On completion, show `Model ready` or `Model needs attention` plus the selected
  provider and model.
- Do not display timeout limits, response byte limits, internal routing details,
  or release-validation wording as though it were an active operation.

### Automatic checks

- Show only active, paused, or disabled status.
- Show the last run and next run in human-readable local time when available.
- Offer only `Pause`, `Resume`, or the applicable disabled state.
- Do not expose incremental-plan terminology or internal scheduling reasons.

### Review preferences

- Explain that feedback remains local and affects only review order or local
  suppression.
- When no repeated false-positive pattern qualifies, show one quiet empty state.
- When a pattern qualifies, allow the user to suppress it from primary review.
- Suppression must not change scanning, evidence, policy evaluation, findings in
  `View all issues`, proposals, approvals, or note writes.

### Local diagnostic data

- Explain that technical scan traces stay on the device.
- Offer one `Delete diagnostic traces` action with an explicit confirmation step.
- State that deletion does not modify vault notes or issue history.
- Remove per-scan deletion, trace inventory, and JSON export from the workspace.

On narrow panes, each section becomes a single column and its action fills the
available width. Keyboard order follows the visual order, focus remains visible,
and status changes use live-region semantics without relying on color alone.

## Removed User Interface

Remove these surfaces from Diagnostics:

- Policy Studio and YAML/template editing;
- manual change-impact inspection;
- observability timeline, lineage, configuration, metrics, and trace export;
- prompt registry;
- evaluation and quality dashboards;
- replay guidance;
- AI debug console;
- fingerprints, token counts, queue depth, raw pattern keys, and internal IDs.

Maintenance findings continue through the ordinary issue-review flow. Policy
evaluation, trace capture, provider boundaries, exact preview, approval,
preflight, rollback, and re-indexing remain internal behavior and are not removed.

## Architecture And Compatibility

The change is primarily a presentation-boundary reduction:

- replace the current collection of independent advanced views with one focused
  Diagnostics component;
- reuse model-readiness, maintenance scheduling, local-feedback, and trace-deletion
  callbacks through narrower user-facing props;
- stop wiring Policy Studio, manual impact inspection, prompt metadata, quality
  dashboards, and debug-console components into the workspace;
- retain core policy, observability, evaluation, maintenance, and storage modules
  where they support scanning, safety, tests, release evidence, or compatibility;
- retain existing custom-policy file evaluation for compatibility, but do not
  advertise or expose policy authoring in the v0.1 workspace;
- replace any error that directs users to Policy Studio with an accurate recovery
  message that does not point to the removed interface.

No provider request shape, scan result, finding, proposal, approval, vault write,
or database schema changes as part of this work.

## Error And Privacy Behavior

- Model connection failures use one actionable, redacted message and never show an
  API key, endpoint payload, prompt, note excerpt, or raw model output.
- Trace deletion requires confirmation, fails closed, and reports failure without
  claiming that data was deleted.
- The deletion control affects diagnostic traces only; it cannot delete notes,
  findings, approvals, feedback, or scan history.
- Review suppression remains an explicit local action available only after the
  existing false-positive threshold is met.

## Verification

Automated checks must cover:

- only the four approved sections render under Diagnostics;
- every removed surface and technical label is absent;
- connection success, progress, and failure states;
- maintenance active, paused, and disabled states;
- empty and eligible local-feedback states;
- diagnostic-trace confirmation, success, cancellation, and failure;
- narrow-pane layout, accessible names, status announcements, and keyboard order;
- existing scan, policy evaluation, feedback classification, approval, apply,
  rollback, and trace-storage tests continue to pass.

Manual acceptance must verify the approved mockup's hierarchy in narrow and wide
panes, light and dark themes, keyboard navigation, and that trace deletion leaves
notes and issue history unchanged.

## Documentation Changes

Update the authoritative product and acceptance documents so Policy Studio,
developer observability, prompt registry, evaluation dashboards, replay guidance,
and the AI debug console are no longer release UI requirements. Record the
intentional v0.1 scope reduction in `docs/progress.md`. Internal architecture and
release-evaluation documentation remain because the underlying systems continue
to operate outside the normal user interface.
