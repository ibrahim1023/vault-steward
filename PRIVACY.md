# Privacy

Vault Steward is local-first. It reads the active Obsidian vault through the Obsidian adapter and persists canonical local state in the plugin's SQLite-compatible database.

## Data Boundary

The plugin does not require an account, cloud storage, or a remote API. Local model requests are restricted to configured loopback Ollama or llama.cpp-compatible endpoints. Vault content is not sent to an external service by the plugin.

## Local Storage

The database stores indexed state, findings, proposals, approvals, audits, and metadata-only observability records. Default traces exclude note bodies, prompts, raw model output, absolute paths, URLs, and secrets. Optional retained categories are visible and user-controlled.

## Deletion And Exclusions

Users can configure trace retention, delete individual traces, delete all telemetry, and exclude configured folders from retained trace material. Note mutations always require explicit approval and current-revision validation.

Read `OBSERVABILITY.md` for the retained-data inventory and `docs/runbooks.md` for local recovery procedures.
