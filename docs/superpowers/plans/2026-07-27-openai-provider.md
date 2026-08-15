# OpenAI Provider Plan

## Goal

Add an explicit opt-in OpenAI provider alongside the existing loopback-only
Ollama and llama.cpp providers. The default remains Ollama.

## Boundaries

- Use the fixed `https://api.openai.com/v1/chat/completions` endpoint.
- Send only the bounded prompt already prepared for a semantic route.
- Use `store: false`, JSON mode, bounded timeout/output/response limits, and
  Authorization Bearer authentication.
- Keep API keys out of traces, fingerprints, exports, diagnostics, and UI.
- Require an explicit cloud-data acknowledgement before the plugin can scan
  with OpenAI.
- Do not provide arbitrary remote endpoint configuration in this phase.

## Tasks

1. Add a typed provider union and OpenAI Chat Completions adapter.
2. Add provider selection, API-key input, and cloud-data acknowledgement to
   plugin settings.
3. Route scans, readiness checks, and finding explanations through the selected
   provider without changing deterministic validation or approval controls.
4. Add hermetic provider/settings tests and update privacy, security,
   installation, troubleshooting, and manual-acceptance documentation.
