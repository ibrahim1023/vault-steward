# Privacy

Vault Steward is local-first. It reads the active Obsidian vault through the Obsidian adapter and persists canonical local state in the plugin's SQLite-compatible database.

## Data Boundary

The plugin does not require an account, cloud storage, or a remote API for its default local-provider mode. Local model requests are restricted to configured loopback Ollama or llama.cpp-compatible endpoints.

HyperFusion and OpenAI are optional, explicit cloud providers. When the user
selects one, enters that provider's API key, and enables that provider's
cloud-data acknowledgement, the plugin sends the bounded prompt and selected
evidence required for that semantic request only to the provider's fixed API
origin. An OpenAI acknowledgement never authorizes HyperFusion, and a
HyperFusion acknowledgement never authorizes OpenAI. It does not send traces,
metrics, raw outputs, or telemetry to either provider. The plugin does not
expose arbitrary remote provider endpoints.

## Local Storage

The database stores indexed state, findings, proposals, approvals, audits, and metadata-only observability records. Default traces exclude note bodies, prompts, raw model output, absolute paths, URLs, and secrets. Cloud API keys remain in local plugin settings and are excluded from observability, configuration fingerprints, diagnostics, and portable exports. Optional retained categories are visible and user-controlled.

## Deletion And Exclusions

Prepared repair batches store proposal and finding identifiers plus numeric
outcome counts. They do not duplicate note bodies, evidence excerpts, prompts,
or replacement text. Users can configure trace retention, delete individual
traces, delete all telemetry, and exclude configured folders from retained
trace material. Note mutations always require explicit approval, whole-batch
preflight, and current-revision validation. Removing retained diagnostic traces
does not modify vault notes or approval history.

Read `OBSERVABILITY.md` for the retained-data inventory and `docs/runbooks.md` for local recovery procedures.
