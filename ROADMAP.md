# Roadmap

The roadmap tracks concrete product work rather than delivery dates. It has no
release dates or availability promises, and shipped behavior remains governed
by `spec.md`. The proposed maintenance scope below is defined in the
[maintenance roadmap spec](docs/superpowers/specs/2026-09-14-maintenance-foundation-roadmap.md)
and becomes committed work only after its required ADR and design gates are
approved.

## 0.3.0 — Maintenance Foundation (proposed)

Scope is bounded by the approved
[0.3.0 implementation plan](docs/superpowers/plans/2026-09-28-maintenance-foundation.md);
implementation has not started.

- Stable finding identity with snapshot-bound occurrences, so findings can be
  tracked across restarts and scans — decided in
  [ADR 0008](docs/decisions/0008-stable-finding-identity-and-occurrences.md)
  (accepted design, not shipped).
- An append-only typed integrity event store that keeps approval/apply audit
  lineage separate from deletable diagnostics — decided in
  [ADR 0009](docs/decisions/0009-integrity-event-store-and-retention.md)
  (accepted design, not shipped).
- Changes Since Last Check comparing completed scans only: new, unchanged,
  changed, recurring, and resolved findings.
- A Steward Inbox with reversible dispositions (`acknowledged`, `ignored`,
  `snoozed`, `expected`, `restored`) that never writes to the vault and uses
  `Review fix` for repairable findings.
- A basic Timeline connecting scans, findings, dispositions, proposals,
  approvals, applies, and recovery.
- The existing selected-finding Ask Why and duplicate canonical review
  integrated into the Inbox.
- Groq as a fixed-origin, separately consented opt-in provider with
  Available/Compatible/Validated model qualification and bounded retry.
- Cloud API keys moved to Obsidian SecretStorage; settings keep secret IDs only.
- Windows and Linux manual validation before any support claim.
- A consented, redacted real-vault quality-case workflow.

Scheduled deterministic checks may remain disabled by default; scheduled cloud
semantic checks are out of scope for `0.3.0` without a separate
provider-specific opt-in.

## 0.4.0 — Prioritization and Impact (proposed)

- A category Health dashboard driven by a deterministic, versioned formula with
  published factor values; status and counts stay primary and the 0-100 score
  secondary.
- Impact-weighted staleness, bounded graph impact, and a deterministic blast
  radius that separates exact operation effects from expected post-scan
  outcomes.
- An expanded policy-backed decision lifecycle, relationship anomalies, and
  comparable trend segments.
- No score or impact value ever authorizes a write.

## 0.5.0 — Ongoing Intelligence (proposed)

- Learned rule and policy suggestions in a typed, versioned pattern vocabulary,
  each with a deterministic simulated effect and explicit Policy Studio save.
- Expanded fixed-question Ask Why with citation validation.
- Provider-aware scheduled semantic checks behind separate provider-specific
  background-cloud consent.
- Richer timeline and comparison, plus only narrow schema-backed relationship
  repairs proven safe.

The roadmap is not a promise of release order or availability.
