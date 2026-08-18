# Changelog

All notable changes to Vault Steward are documented in this file.

## 0.1.0 - 2026-08-18

Initial public release candidate.

### Added

- Local-first Obsidian vault checks for references, tasks, decisions, schemas,
  policies, stale knowledge, and related integrity signals.
- Coordinated deterministic and model-assisted review with exact evidence and
  Current/After previews.
- Explicit selection and approval before any supported note repair is applied.
- Ollama and llama.cpp local providers, plus experimental opt-in OpenAI and
  HyperFusion providers with provider-specific acknowledgement.
- Local history, diagnostics, review preferences, maintenance checks, and
  packaged SQLite state.

### Security

- Revision-bound proposals, stale and overlapping edit rejection, conditional
  rollback, and recovery-required handling protect vault writes.
- Bounded vault, policy, YAML, provider-output, and structured-output parsing
  fail closed on malformed or excessive input.
- Persisted findings are validated against runtime contracts before UI
  hydration.
- API keys and diagnostic traces remain local; cloud providers use fixed
  origins and require explicit per-provider consent.

### Compatibility

- Obsidian desktop 1.5.0 or later.
- SQLite WebAssembly is embedded in `main.js` for a self-contained Community
  Plugins installation.
- macOS is validated. Windows and Linux remain unvalidated for this release.
