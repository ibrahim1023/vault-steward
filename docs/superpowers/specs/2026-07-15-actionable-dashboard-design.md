# Actionable Dashboard Design

## Purpose

Replace the current sequential review workspace with an operational dashboard that answers two questions immediately: what is the vault's current health, and what should the reviewer address next? The dashboard remains local-first, evidence-bound, and review-only until the existing proposal approval flow is explicitly invoked.

## Scope

This work changes the active Vault Steward workspace and how it presents the latest completed scan. It does not change scanning, finding normalization, SQLite history retention, model-provider permissions, or the revision-safe proposal/apply contracts.

The dashboard must retain the command-palette entry and add a left-ribbon launcher so a user can reopen Vault Steward after reinstalling or closing its view.

## Information Architecture

The workspace has one long, responsive page in this order:

1. **Vault health:** vault name, latest scan state, and counts for critical, high, medium, low, and informational findings.
2. **Next best action:** one selected open finding, chosen deterministically from the active queue.
3. **Priority findings:** a compact, severity-grouped list that opens a selected finding in the detail area.
4. **Finding detail:** evidence, affected note, confidence, explanation, available repair action, and existing proposal review UI when applicable.
5. **History and diagnostics:** native collapsible sections, closed by default.

The page is not a collection of nested cards. Summary and priority areas are unframed sections with concise rows; a visible border is reserved for the selected action/detail surface and the existing proposal diff.

## Active Queue and Ranking

The active queue contains findings from the latest completed scan only. Historical findings remain available to lifecycle/history queries but never contribute to current health counts or priority actions.

`Next best action` chooses an unresolved finding using this stable order:

1. severity: critical, high, medium, low, info;
2. confidence: descending;
3. finding ID: ascending.

The selected finding initially matches `Next best action`. Selecting any priority row updates the detail surface only; it never starts a repair, changes finding status, or changes the scan result.

## States and Recovery

- **Ready with findings:** show health, next action, priority list, selected detail, and collapsed history/diagnostics.
- **Ready without findings:** show a calm health state, last completed scan time, and the scan action. Do not show an empty repair selector.
- **Scanning:** retain the last successful dashboard content as read-only context, show progress, and disable only the scan trigger.
- **Scan failure:** retain the last successful dashboard content, show a precise content-safe error and recovery action, and keep Run scan available. A failed scan must not erase the active queue.
- **No completed scan:** show a clear initial state and Run scan action.

## Finding Detail and Repair Safety

The detail surface renders the selected finding's severity, evidence locator, affected notes, confidence, explanation, and limitations. It displays an eligible reference-repair control only for a selected `broken-reference` finding. Other finding types never show disabled or misleading repair controls.

Preparing a repair remains deterministic and does not write a vault note. Approval, stale-revision detection, apply confirmation, and re-index behavior remain owned by the existing review workflow. Dashboard controls cannot approve or apply a proposal implicitly.

## Accessibility and Narrow Panes

All controls use native buttons, selects, inputs, and disclosure elements with visible labels. Priority rows are keyboard reachable and expose selected state. Counts are text, not color-only indicators. On narrow sidebars, summary counts wrap into stable rows, action labels wrap instead of clipping, and the finding detail follows the priority list rather than using a second column.

## Component Boundaries

- `VaultStewardWorkspace`: owns scan state, latest queue refresh, selected-finding state, and the existing proposal workflow handoff.
- `VaultHealthSummary`: derives status/count presentation from the active queue and latest scan metadata.
- `NextBestAction`: renders the deterministic top finding and selects it on request.
- `PriorityFindings`: renders severity groups and reports a selected finding ID.
- `FindingDetail`: renders evidence and conditionally hands an eligible reference finding to the existing repair controls.
- `HistoryView` and diagnostics remain data-owning consumers of existing read-only queries.

The ranking helper is pure and tested independently. Components receive typed finding data and callbacks; no UI component imports Obsidian APIs or SQLite repositories.

## Verification

Tests must cover severity-first ranking, confidence and ID tie-breaking, latest-scan-only counts, empty/scanning/error preservation, keyboard selection, repair eligibility, and narrow-pane rendering. Plugin lifecycle coverage must verify both the existing command and the new ribbon launcher open the status view. The completion gate includes focused UI tests, unit tests, formatting, linting, type checking, build, packaging/install smoke, and a manual Obsidian sidebar check.

## Explicit Non-Goals

- Policy authoring, model explanation, scheduling, export/import, and feedback capture remain separate Phase 9/10 work.
- No automatic repair, background approval, remote model call, telemetry, or persistent note content is introduced.
- The dashboard does not replace the persisted audit history.
