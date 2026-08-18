# ADR: sql.js WebAssembly Storage Runtime

## Status

Accepted for the initial desktop-plugin storage implementation.

## Context

Vault Steward requires SQLite as its canonical local state store. The plugin runs in Obsidian's desktop renderer, where native Node SQLite bindings introduce ABI, Electron-version, and platform-specific packaging risk. The storage runtime must remain local-only, package with the plugin, and allow a database file to be read and written through Obsidian's binary vault adapter.

## Decision

Use `sql.js` 1.14.1 as the initial SQLite runtime behind a storage adapter. It compiles SQLite to WebAssembly and uses an in-memory database that can be initialized from and exported to `Uint8Array` bytes. The production build embeds the WebAssembly bytes in `main.js`, so the runtime does not require an extra file that Obsidian's Community Plugins installer will not download. The canonical database file path is `<configDir>/plugins/vault-steward/vault-steward.sqlite` and is accessed through Obsidian's `readBinary` and `writeBinary` APIs.

## Evidence From The Spike

- The runtime creates a database, executes parameterized SQL, exports database bytes, and closes deterministically in the TypeScript test environment.
- The build embeds the SQLite WebAssembly bytes in `main.js`, avoiding both an implicit CDN dependency and an unsupported extra install artifact.
- Obsidian's typed API exposes `Vault.configDir`, `DataAdapter.readBinary`, and `DataAdapter.writeBinary`, which provide the required plugin-local binary-file boundary.

## Alternatives Considered

- Native Node bindings such as `better-sqlite3`: rejected for the initial release because they require Electron ABI-specific rebuilds and platform packaging validation.
- SQLite WASM from a lower-level upstream wrapper: deferred because it adds integration surface without improving the current repository requirements.
- JSON-only persistence: rejected because it does not meet the canonical SQLite requirement or provide migrations and transactional repository semantics.

## Consequences

`sql.js` keeps the active database in memory. Every successful write must export the complete database and persist it atomically through the Obsidian adapter; the repository layer must serialize writes and surface failed persistence. Embedding increases `main.js` size but makes the official installation self-contained. Large-vault memory pressure remains a tracked limitation. The storage adapter owns sql.js and the Obsidian binary adapter boundary; core modules continue to depend on repository contracts only.

## Reversal Strategy

Repositories remain adapter-backed. A future native SQLite implementation can import the exported SQLite file and preserve the schema/migration sequence without changing core contracts.
