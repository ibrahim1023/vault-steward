# Product Interpretation

## Authority

`spec.md` is the source of truth for product behavior. This document interprets it for implementation without extending scope.

## Users and Problem

Obsidian users with long-lived, personally owned vaults need to find integrity problems before they become difficult to understand or correct. They need evidence and proposed changes, not autonomous rewriting.

## Core Journey

The user chooses a local vault and policy set, starts a scan, reviews evidence-backed findings, inspects a generated diff for an individual approved change, applies it, and receives a re-indexed result. Scanning may be repeated, but no step modifies the vault before explicit approval.

## Requirements

- Parse Markdown, frontmatter, links, tags, tasks, attachments, and build a canonical graph.
- Surface entity duplication, contradictions, staleness, broken references, task issues, schema violations, decision gaps, and policy violations.
- Store each finding with ID, type, severity, evidence, affected notes, policy, explanation, fixes, and confidence.
- Operate offline with local models and user-owned data only.
- Support user-defined YAML governance policies.

## Non-Functional Constraints

- Local-first, offline-capable, no telemetry, cloud APIs, or remote storage.
- Evidence-first and policy-governed.
- Human approval is mandatory for every note mutation.
- Deterministic results must be reproducible from a scan snapshot.

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
