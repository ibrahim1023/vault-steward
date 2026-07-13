# ADR: Local Obsidian Plugin With SQLite Canonical Storage

## Status

Accepted for the foundation.

## Context

The product requires offline operation, user-owned data, Obsidian integration, auditability, and no cloud dependency.

## Decision

Build a TypeScript Obsidian plugin. Use SQLite as the canonical local indexed store. Treat LanceDB as optional derived retrieval infrastructure behind an adapter.

## Alternatives considered

- Hosted service with remote database
- Files-only index with no database
- LanceDB as the primary store

## Reasons

SQLite supports transactions, migrations, audit records, replayable scan metadata, and local queryability without a server.

## Tradeoffs

Desktop packaging and SQLite library compatibility need validation. SQLite is not a semantic-search engine, so semantic retrieval remains optional.

## Consequences

Storage interfaces and migration tests are required early. No model component may make LanceDB authoritative.

## Migration or reversal strategy

Keep repositories behind interfaces and export canonical records through versioned migrations. A future storage replacement imports SQLite records before cutover.
