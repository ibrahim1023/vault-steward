# Product Interpretation

## Authority

`spec.md` is the source of truth for product behavior. This document interprets it for implementation without extending scope.

## Users and Problem

Obsidian users with long-lived, personally owned vaults need to find integrity problems before they become difficult to understand or correct. They need evidence and proposed changes, not autonomous rewriting.

## Core Journey

The user selects **Check vault**. Vault Steward ranks the completed scan and
prepares the highest-value bounded repair it can validate. The user sees the
exact current and proposed references, the deterministic expected result, and
one **Apply N fixes** action. That action records explicit approval, applies the
revision-safe batch, re-indexes the vault, and reports the actual result. When
no safe repair exists, the user receives one concrete review action instead of
an unsupported edit.

## Requirements

- Parse Markdown, frontmatter, links, tags, tasks, attachments, and build a canonical graph.
- Surface entity duplication, contradictions, staleness, broken references, task issues, schema violations, decision gaps, and policy violations.
- Store each finding with ID, type, severity, evidence, affected notes, policy, explanation, fixes, and confidence.
- Default to offline operation with local models and user-owned data. OpenAI is
  available only as an explicit opt-in provider with acknowledgement.
- Support user-defined YAML governance policies.
- Keep the full issue list and operational tools available under a separate
  **Advanced** surface.

## Non-Functional Constraints

- Local-first, offline-capable by default, no telemetry or remote storage.
- Evidence-first and policy-governed.
- Human approval is mandatory for every note mutation.
- Deterministic results must be reproducible from a scan snapshot.
- Models may select only from bounded candidates and may abstain. They cannot
  construct patches, authorize writes, or calculate outcomes.

## Non-Goals

- Autonomous note editing, cloud synchronization, collaboration/tenancy, model training, and the future-extension agents listed in `spec.md`.
- A standalone server, hosted service, or unrestricted shell/tool agent.

## Assumptions

- One plugin installation operates on one selected local vault at a time.
- The Obsidian plugin process can read vault files through the Obsidian API; file changes outside the plugin are detected by re-scan or vault events.
- YAML policy files and schemas are user-authored local configuration.
- Optional semantic retrieval is an optimization, not required for the first vertical slice.

## Risks and Questions

- Natural-language contradiction and staleness judgments are probabilistic and need conservative confidence thresholds and review.
- Obsidian API limits and bundled SQLite support must be validated in the first vertical slice.
- The exact policy DSL, schema vocabulary, and safe edit patch format are intentionally deferred to their dedicated plans.
