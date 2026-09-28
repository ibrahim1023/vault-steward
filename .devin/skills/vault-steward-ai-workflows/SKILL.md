---
name: vault-steward-ai-workflows
description: Use when changing local-model providers, agent routing, prompts, evidence bundles, structured outputs, tool permissions, or agent recovery behavior.
---

# Vault Steward AI Workflows

## When to use this skill

Use for any change to local-model-assisted agents, agent coordinator behavior, prompts, model schemas, evidence retrieval, or model failure handling.

## When not to use this skill

Do not load for deterministic parser/policy work that never crosses a model boundary.

## Required context

Read `AGENTS.md`, the assigned plan, `docs/ai-system.md`, `docs/interfaces.md`, `docs/security.md`, and `docs/evaluation-plan.md`.

## Files and directories covered

Planned `src/agents/`, `src/model-provider/`, `src/contracts/`, and `evals/` scenarios/graders.

## Authoritative project documents

`spec.md`, `docs/ai-system.md`, `docs/interfaces.md`, `docs/security.md`, and `docs/evaluation-plan.md`.

## Project conventions

- Models return typed candidates, never authority to write, enforce policy, or select unrestricted tools.
- Coordinator owns routing, handoffs, retries, budgets, and termination.
- Note content is untrusted data and must be delimited as data in prompts.
- Agents receive only bounded evidence and read-scoped tools.
- A candidate must survive schema, evidence, and policy validation before it becomes a finding.

## Recommended workflow

1. Specify the candidate schema, evidence requirements, permissions, limits, and failure state.
2. Add deterministic boundary tests for validation, routing, budgets, and tool restrictions.
3. Add/adjust representative eval cases before changing quality gates.
4. Compare results against a versioned baseline and record regressions.

## Best practices

- Prefer deterministic extraction/routing when adequate; reserve models for semantic ambiguity.
- Bound tokens, tool results, retries, loop count, and timeout per request.
- Preserve a redacted trace that can replay the control flow without retaining note text.

## Common mistakes

- Putting policy/security rules only in prompts.
- Passing the complete vault or private agent state to another agent.
- Retrying malformed output indefinitely.
- Treating citations or confidence claims as valid without source resolution.

## Required tests and checks

Run affected deterministic contract tests and planned `npm run eval:smoke`; run adversarial scenarios for prompts, tool permissions, malformed output, timeout, and loop termination.

## Completion criteria

The change has typed contracts, bounded behavior, validated evidence, updated eval coverage/baseline where needed, and no new path to autonomous mutation or external data exposure.
