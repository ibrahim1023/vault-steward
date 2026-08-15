# Contributing

Contributions must preserve Vault Steward's local-first and deterministic-control boundaries. Read `AGENTS.md` before changing code.

## Setup

Install Node.js 20 or newer, run `npm install`, then use the checks listed in `README.md`. A local model is needed only for opted-in model evaluation or a completed governed scan.

## Quality Rules

- Add deterministic tests before changing deterministic behavior.
- Place probabilistic quality checks and fixtures under `evals/`, not brittle unit snapshots.
- Keep model outputs typed, bounded, cited, and independently validated.
- Do not add telemetry, shell execution, broad filesystem access, autonomous
  mutation, or unapproved remote endpoints. OpenAI remains limited to the fixed
  API origin, explicit opt-in, bounded evidence, and cloud acknowledgement.
- Update contracts, tests, baselines, and documentation together when their observable behavior changes.

## Fixtures, Prompts, And Policies

Fixture cases must use synthetic data, stable IDs, relative locators, split/contamination metadata, and no user-vault content. Prompt, model, schema, threshold, retrieval, policy, and agent changes require the relevant replay/comparison or evaluation evidence. Policy changes require deterministic parsing/evaluation coverage and remain explicit user saves.

## Review Gate

Run the narrowest relevant tests first, then formatting, linting, type checking, build/package checks, applicable evaluation commands, and the security audit before requesting review.

Provider or prompt changes that affect release behavior must rerun the Northstar
corpus for both Ollama and OpenAI. Do not update a baseline or threshold without
a dated rationale and reviewer in the release quality report.
