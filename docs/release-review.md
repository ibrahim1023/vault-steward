# MVP Release Review

## Phase 10 Addendum

The post-MVP review confirms local scheduler guards, deterministic maintenance grouping/impact inspection, redacted portability contracts, release artifact checks, and the desktop accessibility protocol. Automated evidence passes; the documented desktop protocol remains required before wider distribution.

## Manual Desktop Acceptance

Completed on 2026-07-16: ribbon and command-palette launch, governed scanning, maintenance impact inspection, policy preview/save, model readiness, offline failure recovery, and packaged-plugin reinstall/reopen were exercised in Obsidian desktop.

## Decision

**Development promotion, not release acceptance.** The package and deterministic
safety controls are approved to advance `development` so Phase 20 work can
continue. Broader distribution remains blocked until the revised simple
AI-guided Phase 19 flow passes manual macOS acceptance, OpenAI has a passing
release-corpus report, and the combined provider gate passes. Its automated
gate passed on 2026-07-29; the earlier dashboard workbench is not the release
candidate.

## Reviewed Controls

- Product behavior: scans are local-first, evidence-backed, and require local model analysis for a governed completion.
- Architecture and interfaces: the Obsidian boundary remains outside the core; SQLite is canonical; model output is citation-validated and cannot authorize mutation.
- Privacy and security: local-only provider endpoints, no telemetry/cloud/shell/broad scan capability, redacted diagnostics, bounded input/output, revision-safe apply, and dependency auditing are enforced.
- Reliability: migrations, corrupt database bytes, vault I/O, cancellation, provider failures, malformed structured output, duplicate events, restart recovery, and apply/re-index recovery paths have deterministic coverage.
- Operations: performance and operational thresholds are versioned and verified through local smoke gates.
- Usability: the release candidate must expose one dominant action, exact
  Current/After output, deterministic expected and actual results, direct
  Settings and History, and technical tools under Diagnostics.
- Acceptance: the synthetic vault exercises references, entities, contradictions, staleness, tasks, schemas, decisions, policies, coordinator routing, proposal construction, approval, apply, and re-index.

## Release Conditions

1. Completed on 2026-07-14: every automated command in `AGENTS.md`, plus the MVP acceptance suite, passed from the Phase 6 branch.
2. Before broad distribution, install the revised package into the Northstar
   Acceptance vault and complete the full result-first Ollama and OpenAI matrix.
3. Produce passing provider reports from the same versioned Northstar corpus,
   then pass `npm run eval:marketplace:gate`.
4. Keep the limitations in `docs/known-limitations.md` visible in release notes
   and do not claim marketplace availability.

## Remaining Limitations

- The revised prepared-batch UI and bounded recommender have automated coverage
  but remain unaccepted in Obsidian desktop.
- Model quality gates need calibration on representative local fixtures before wider distribution.
- The committed corpus and regression harness pass deterministic tests, and
  `gemma3:12b` passes the Ollama report; the acknowledged OpenAI report and
  combined provider gate remain pending.
