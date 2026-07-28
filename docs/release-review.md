# MVP Release Review

## Phase 10 Addendum

The post-MVP review confirms local scheduler guards, deterministic maintenance grouping/impact inspection, redacted portability contracts, release artifact checks, and the desktop accessibility protocol. Automated evidence passes; the documented desktop protocol remains required before wider distribution.

## Manual Desktop Acceptance

Completed on 2026-07-16: ribbon and command-palette launch, governed scanning, maintenance impact inspection, policy preview/save, model readiness, offline failure recovery, and packaged-plugin reinstall/reopen were exercised in Obsidian desktop.

## Decision

**Internal testing only.** The package and deterministic safety controls remain
usable for development, but broader distribution is blocked until the revised
simple AI-guided Phase 19 flow passes its automated gate and manual macOS
acceptance. The earlier dashboard workbench is not the release candidate.

## Reviewed Controls

- Product behavior: scans are local-first, evidence-backed, and require local model analysis for a governed completion.
- Architecture and interfaces: the Obsidian boundary remains outside the core; SQLite is canonical; model output is citation-validated and cannot authorize mutation.
- Privacy and security: local-only provider endpoints, no telemetry/cloud/shell/broad scan capability, redacted diagnostics, bounded input/output, revision-safe apply, and dependency auditing are enforced.
- Reliability: migrations, corrupt database bytes, vault I/O, cancellation, provider failures, malformed structured output, duplicate events, restart recovery, and apply/re-index recovery paths have deterministic coverage.
- Operations: performance and operational thresholds are versioned and verified through local smoke gates.
- Usability: the release candidate must expose one dominant action, exact
  Current/After output, deterministic expected and actual results, and Advanced
  tools outside the primary path.
- Acceptance: the synthetic vault exercises references, entities, contradictions, staleness, tasks, schemas, decisions, policies, coordinator routing, proposal construction, approval, apply, and re-index.

## Release Conditions

1. Completed on 2026-07-14: every automated command in `AGENTS.md`, plus the MVP acceptance suite, passed from the Phase 6 branch.
2. Before broad distribution, install the revised package into the Northstar
   Acceptance vault and complete the full result-first Ollama and OpenAI matrix.
3. Keep the limitations in `docs/known-limitations.md` visible in release notes
   and do not claim marketplace availability.

## Remaining Limitations

- The revised prepared-batch UI and bounded recommender remain under
  implementation until the Phase 19 gate passes.
- Model quality gates need calibration on representative local fixtures before wider distribution.
