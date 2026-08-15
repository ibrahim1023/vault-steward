# ADR 0006: OpenAI As An Explicit Opt-In Model Provider

## Status

Accepted on 2026-07-27.

## Context

Vault Steward originally allowed only loopback Ollama and llama.cpp model
providers. Users also need an OpenAI option, but vault evidence is sensitive and
the existing local-only promise must not become an accidental remote endpoint.

## Decision

Keep Ollama as the default. Add OpenAI as a separate provider that sends
bounded, already-prepared semantic prompts to the fixed
`https://api.openai.com/v1/responses` origin using Bearer authentication,
JSON mode, `store: false`, timeout/response caps, and redirect rejection.

The user must select OpenAI, enter an API key, and acknowledge that bounded
selected vault evidence leaves the device. The API key is stored only in the
local Obsidian plugin data file. It is excluded from trace metadata,
configuration fingerprints, diagnostics, and portability exports. Arbitrary
remote or OpenAI-compatible base URLs are not configurable.

## Consequences

The product is no longer universally local-only. Local providers remain
available and are the default. Documentation, privacy controls, manual testing,
and acceptance tests must distinguish local use from the OpenAI opt-in path.
