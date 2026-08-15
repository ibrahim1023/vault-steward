# OpenAI Responses API Migration Plan

## Goal

Replace the initial OpenAI Chat Completions adapter with the current Responses
API without broadening Vault Steward's cloud-data boundary.

## Scope

1. Change the fixed endpoint to `/v1/responses`.
2. Send bounded evidence through `input` and fixed JSON-only instructions.
3. Request JSON mode using `text.format`, cap `max_output_tokens`, and retain
   `store: false`.
4. Parse only `output_text` content from completed response messages; do not
   interpret tool calls, reasoning items, or other response data.
5. Update hermetic tests and documentation; do not call the live API in CI.

## Non-Goals

- No arbitrary OpenAI-compatible endpoints.
- No tools, conversation state, background jobs, or remote telemetry.
- No change to deterministic evidence validation or mutation approval.
