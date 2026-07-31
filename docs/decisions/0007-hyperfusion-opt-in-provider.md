# ADR 0007: HyperFusion As A Fixed-Origin Opt-In Provider

## Status

Accepted on 2026-07-31. Validation in progress.

## Context

HyperFusion provides an OpenAI-compatible Chat Completions API and is the next
cloud-provider validation target. Vault evidence remains sensitive, so generic
OpenAI-compatible endpoints cannot be permitted.

## Decision

Keep Ollama as the local-first default. Add HyperFusion as a separate provider
that sends bounded, already-prepared semantic prompts only to
`https://api.hyperfusion.io/v1/chat/completions` with Bearer authentication.
The adapter reads only `choices[0].message.content`, applies timeout and
response-size limits, and rejects redirects and malformed responses.

The user must select HyperFusion, enter an API key, and acknowledge that
bounded selected vault evidence leaves the device. The key remains in local
Obsidian plugin data and is excluded from trace metadata, configuration
fingerprints, diagnostics, portability exports, and reports. The endpoint is
not configurable.

## Consequences

HyperFusion is labelled validation-in-progress until its bounded corpus and
manual macOS evidence pass. A provider result remains subject to the same typed
validation, evidence checks, exact preview, and explicit-approval workflow as
local providers. It cannot authorize or perform vault writes.
