# MVP Release Review

## Phase 10 Addendum

The post-MVP review confirms local scheduler guards, deterministic maintenance grouping/impact inspection, redacted portability contracts, release artifact checks, and the desktop accessibility protocol. Automated evidence passes; the documented desktop protocol remains required before wider distribution.

## Manual Desktop Acceptance

Completed on 2026-07-16: ribbon and command-palette launch, governed scanning, maintenance impact inspection, policy preview/save, model readiness, offline failure recovery, and packaged-plugin reinstall/reopen were exercised in Obsidian desktop.

## Decision

**Development promotion complete, not release acceptance.** Phase 30 security
hardening was promoted to `development` at `bdd770f` on 2026-08-12 after the
full automated gate and macOS acceptance retest passed. Broader distribution
remains blocked on the submission materials and release-owner review listed in
the Community Plugins checklist. HyperFusion and OpenAI remain experimental
opt-in providers.

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

- Current macOS screenshots, a short demonstration, release tag/version
  evidence, and release-owner review remain required before submission.
- The external deep-security scan service has an invalid saved inventory, so a
  replacement third-party report is unavailable; local source review and
  regression gates are complete.
- Both cloud providers remain experimental opt-in paths despite their passing
  redacted validation reports.
