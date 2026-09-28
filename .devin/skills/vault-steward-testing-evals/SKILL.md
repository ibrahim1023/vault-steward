---
name: vault-steward-testing-evals
description: Use when adding Vault Steward tests, fixtures, deterministic graders, evaluation datasets, scenarios, baselines, or CI quality gates.
---

# Vault Steward Testing and Evals

## When to use this skill

Use for unit/integration/contract tests, fixture vaults, evaluation datasets, deterministic graders, agent scenarios, result baselines, or CI verification work.

## When not to use this skill

Do not load for a production change with no test/eval or quality-gate impact; use the more targeted implementation skill instead.

## Required context

Read `AGENTS.md`, the assigned plan, `docs/testing-strategy.md`, and `docs/evaluation-plan.md` plus the changed contract.

## Files and directories covered

Planned `tests/` and `evals/datasets/`, `evals/fixtures/`, `evals/graders/`, `evals/scenarios/`, `evals/baselines/`, and `evals/reports/`.

## Authoritative project documents

`docs/testing-strategy.md`, `docs/evaluation-plan.md`, `docs/interfaces.md`, and `docs/ai-system.md`.

## Project conventions

- Tests own deterministic correctness; evals own probabilistic quality.
- Prefer synthetic, minimal vault fixtures with stable IDs and source locators.
- Version every evaluation case, prompt/model schema, grader, and baseline together.
- Deterministic graders are required for schema, evidence, tool trace, policy, and state invariants.

## Recommended workflow

1. State whether the behavior is deterministic or probabilistic.
2. Add the smallest fixture/case that isolates the risk.
3. Write a deterministic assertion or a metric/threshold with a clear grader.
4. Run the narrow suite, then update baseline only with documented rationale.

## Best practices

- Separate development, CI, held-out, adversarial, and human-review sets.
- Include malformed output, timeout, injection, stale revision, and partial failure cases.
- Report tokens, latency, retries, tool calls, and incomplete rate for agent evals.

## Common mistakes

- Exact-matching free-form model prose in unit tests.
- Using prompt-development examples as held-out evaluation data.
- Accepting uncalibrated model-judge scores as the only gate.
- Updating baselines to hide regressions.

## Required tests and checks

Run the focused deterministic test suite and planned `npm run eval:smoke`; use `npm run eval:full` for model, prompt, routing, or baseline changes.

## Completion criteria

The test/eval has a bounded purpose, reproducible fixture, versioned expectation or gate, appropriate data split, and recorded verification result.
