# MVP Release Review

## Decision

**Conditional internal MVP release approved.** The package, deterministic core, local-model boundary, safety controls, and automated Phase 6 gates are ready for local developer installation. Broader distribution is blocked on a manual Obsidian desktop check and on wiring semantic findings and proposal actions into the live workspace.

## Reviewed Controls

- Product behavior: scans are local-first, evidence-backed, and require local model analysis for a governed completion.
- Architecture and interfaces: the Obsidian boundary remains outside the core; SQLite is canonical; model output is citation-validated and cannot authorize mutation.
- Privacy and security: local-only provider endpoints, no telemetry/cloud/shell/broad scan capability, redacted diagnostics, bounded input/output, revision-safe apply, and dependency auditing are enforced.
- Reliability: migrations, corrupt database bytes, vault I/O, cancellation, provider failures, malformed structured output, duplicate events, restart recovery, and apply/re-index recovery paths have deterministic coverage.
- Operations: performance and operational thresholds are versioned and verified through local smoke gates.
- Usability: the UI review documents keyboard-native controls, accessible scan/error announcements, readable evidence and diff output, narrow-pane behavior, and error recovery.
- Acceptance: the synthetic vault exercises references, entities, contradictions, staleness, tasks, schemas, decisions, policies, coordinator routing, proposal construction, approval, apply, and re-index.

## Release Conditions

1. Completed on 2026-07-14: every automated command in `AGENTS.md`, plus the MVP acceptance suite, passed from the Phase 6 branch.
2. Before broad distribution, install the packaged plugin into a real local Obsidian vault, complete one governed scan with the configured local model, and confirm the status workspace updates correctly.
3. Keep the limitations in `docs/known-limitations.md` visible in release notes until semantic findings and proposal controls are connected to the workspace.

## Remaining Limitations

- The live workspace currently renders deterministic reference findings, not all semantic candidate types.
- The core proposal workflow is explicit-approval and revision safe, but its approval/apply controls are not yet exposed through the Obsidian workspace.
- Model quality gates need calibration on representative local fixtures before wider distribution.
