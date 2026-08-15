# Proactive Maintenance and Release Quality Design

## Purpose

Phase 10 turns completed vault scans into a bounded, user-controlled maintenance routine and completes the release safeguards needed before wider testing.

## Scheduler

Scheduling is disabled by default. The per-vault settings add an interval in minutes, event-trigger toggle, debounce duration, resource budget, and pause state. A pure scheduler decides whether a trigger is eligible using the plugin-loaded state, paused state, scan-in-progress state, last-run time, next-run time, and budget window. It never starts a scan after plugin unload, never overlaps a scan, and coalesces file events into one debounced trigger.

The plugin owns timers and disposal. The workspace shows schedule state, next eligible run, last scheduled run, and pause/resume controls. A failed scheduled scan keeps the scheduler alive and records a user-safe status; it never retries in a tight loop.

## Maintenance Workspace

The maintenance workspace derives its queue from the latest completed scan only. It groups duplicate findings by type plus stable evidence locators, ranks group representatives with the dashboard ordering, and shows count and affected notes without stored note content. It receives existing `ChangeImpact` data through explicit callbacks and renders a read-only project/task/decision/reference impact summary. It never writes rewrites or accepts model-suggested impact operations.

## Redacted Export and Import

Export creates a versioned JSON document containing validated settings, the active policy YAML, review decision metadata, and optional reviewer feedback. It omits database bytes, scans, finding evidence, excerpts, note paths, prompts, raw outputs, provider endpoint, and secrets. Import validates schema, limits arrays and string sizes, applies no changes until explicit confirmation, writes only the fixed policy path, and merges review decisions append-only. Invalid data produces diagnostics with no partial mutation.

## Release Assurance

Release metadata names the supported Obsidian line and package schema. Automated compatibility tests verify manifest/package consistency, fresh migration, populated migration, rollback rehearsal against the database backup, and release artifact completeness. Documentation supplies a repeatable desktop accessibility protocol and a synthetic acceptance-vault recipe. These documents distinguish automated verification from the desktop checks a human must execute.

## Post-MVP Review

The release review captures current objective evidence from automated gates and records unresolved manual checks and known limitations. It does not make unsupported accuracy, compatibility, or security claims.

## Security and Privacy

- Schedules run only in the active Obsidian process and retain no note content.
- Impact and maintenance views consume typed findings/impact metadata only.
- Exports exclude vault data, endpoints, prompts, raw output, and database files.
- Imports validate completely before changes, and explicit user confirmation remains mandatory.
- No scheduler, dashboard, import, or release check grants models tools or write authority.
