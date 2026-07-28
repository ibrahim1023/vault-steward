# Focused Review Workbench Design

## Purpose

Make Vault Steward understandable on a first use without removing the
investigative and operational tools needed by experienced reviewers. The
current single-page workspace exposes every subsystem together, which makes the
initial review path visually noisy and obscures the one action that matters.

The workbench will present a short, severity-ranked review queue beside the
selected finding on wide panes. It will retain the local-first, evidence-bound,
approval-gated behavior of the current product.

## Approved Direction

- Use a hybrid workbench: queue and selected finding are visible together on
  wide panes; narrow panes stack the detail below the queue.
- Use a restrained teal product accent. Amber communicates work requiring
  attention, muted green communicates low-risk/completed states, and red is
  reserved for actual failures. Text and icons always carry the same meaning as
  color.
- Default to the top three ranked findings. A clear `View all findings` action
  expands the entire queue without leaving the workspace.
- Put readiness, policy authoring, maintenance, history, and observability in
  a single collapsed `More` section. The primary review path does not expose
  those controls by default.

## Information Architecture

### Default Review Surface

1. Header: vault label, compact model/readiness state, and one primary `Run
scan` button.
2. Health strip: summary counts rendered as readable status text rather than
   five button-like controls.
3. Review workbench:
   - Queue: top three ranked open findings, each showing semantic severity,
     title, source path, and evidence locator.
   - Detail: selected finding, plain-language explanation, evidence, and its
     applicable action.
4. `View all findings`: expands the queue and exposes severity filters and a
   bounded text filter.
5. `More`: collapsed advanced tools, in this stable order: model readiness,
   Policy Studio, maintenance, history, observability.

The initial selected item remains the deterministic next-best action. Selecting
a row only changes the detail state. It does not start a repair, modify a
finding, or change scan results.

### Repair Flow

A repairable broken reference displays a single `Review repair` action in the
detail surface. Selecting it reveals the replacement target field and proposal
preparation control. The target field is not shown for other finding types.
Proposal preview, explicit approval, confirmation before apply, stale revision
protection, and re-indexing retain their existing contracts.

If proposal preparation fails, show the safe, content-bounded rejection reason.
Never fall back to a generic message when a deterministic reason is available.

### Evidence and Feedback

Evidence explanation and reviewer feedback remain secondary disclosures in the
selected detail. Raw structured model echoes are not rendered. When a provider
returns a structured echo instead of prose, use a deterministic, evidence-only
plain-language fallback.

## Components and State

- `VaultStewardWorkspace` owns expanded-queue state, selected finding state,
  scan state, and the existing proposal handoff.
- `VaultHealthSummary` renders a compact semantic health strip from the latest
  completed scan only.
- `PriorityFindings` gains a compact mode, expanded mode, text/severity
  filtering, and source-aware finding rows. Ranking remains in the existing
  pure dashboard helper.
- `FindingDetail` exposes a single primary action appropriate to the selected
  finding. Repair controls remain a separate child region so their safety logic
  is unchanged.
- A `MoreTools` view owns only disclosure state and composes existing advanced
  views; those views retain their existing data ownership and contracts.

No UI component imports Obsidian APIs, SQLite repositories, or model-provider
internals.

## Visual and Responsive Rules

- Use full-width bands and unframed layouts; reserve bordered surfaces for the
  selected detail, diff preview, and repeated queue rows.
- Use a maximum two-column workbench. Collapse to one column when the sidebar
  cannot maintain a readable queue and detail width.
- Use fixed-size semantic severity markers and stable row layouts so selection,
  labels, and counts cannot shift surrounding content.
- Keep buttons for commands only. Severity counts and queue rows are not
  button-shaped unless they are directly selectable.
- Maintain visible keyboard focus, native controls, and text equivalents for
  all color states.

## States and Errors

- No scan: show the header, one short empty state, and `Run scan`.
- Scanning: preserve the last successful workbench as read-only context and
  disable only the scan command.
- Failure: retain findings and show one actionable, content-safe error.
- No findings: show a calm healthy state without an empty queue, repair field,
  or advanced diagnostics.
- Expanded queue: preserve the selected finding and scroll/focus it into view
  only on explicit keyboard navigation.

## Non-Goals

- No changes to scanning, finding ranking, provider selection, telemetry,
  policy semantics, repair authorization, or write boundaries.
- No automatic repair recommendations beyond existing deterministic proposals.
- No remote assets, telemetry, or new external dependencies.

## Verification

Automated coverage must prove top-three limiting, full-queue expansion,
severity/text filtering, deterministic selection, repair action gating, More
disclosure behavior, keyboard focus, scanning/failure preservation, color-text
equivalence, and narrow-pane stacking. Manual Obsidian acceptance must inspect
first-run clarity, selected-finding context, repair progression, More discoverability,
and visual hierarchy in light and dark themes.
