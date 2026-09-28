# Vault Steward Agent Guide

Vault Steward is a local-first Obsidian plugin that audits a vault for integrity issues. It parses vault content deterministically, uses a configured model provider only for bounded reasoning, and never edits notes without an explicit user approval. Ollama is the default; OpenAI is an explicit opt-in path with a cloud-data acknowledgement.

## Read Order

1. `AGENTS.md`
2. `CONTEXT.md`
3. The assigned task plan in `docs/superpowers/plans/`
4. Only the relevant documents named in `docs/context-map.md`
5. Relevant source files and tests

Product behavior is authoritative in `spec.md`. Architecture, contracts, and operating constraints live in `docs/architecture.md`, `docs/interfaces.md`, `docs/ai-system.md`, `docs/security.md`, and `docs/testing-strategy.md`. Record material deviations in `docs/progress.md`.

## Architecture Boundaries

- Plugin/UI: Obsidian Plugin API, TypeScript, React.
- Core: parser, graph, policy, findings, review workflow, and storage modules; do not import Obsidian APIs into core modules.
- SQLite owns indexed vault state, scans, findings, approvals, and audit records. LanceDB is optional and never the source of truth.
- Deterministic code parses, validates, enforces policy, builds diffs, and applies approved edits. Models may classify, extract candidates, or rank evidence only through typed contracts.
- Model providers are accessed through one bounded abstraction. Ollama and llama.cpp endpoints must be loopback-only. OpenAI may use only the fixed API origin after explicit opt-in and acknowledgement. No telemetry, remote storage, shell execution, or broad filesystem access is permitted.

## Working Rules

- Keep changes scoped to the assigned plan task; do not expand product scope silently.
- Start each implementation phase on a dedicated `feat/phase-*` branch from `development`. Once the phase completion gate passes, commit its final documentation/tests, promote that branch into `development`, and push `development` to `origin` before starting the next phase.
- Prefer existing local patterns and explicit TypeScript types. Keep public contracts in `src/contracts/` when introduced.
- Validate all untrusted input and model output before use. A model result cannot directly mutate vault state, alter policy, or authorize a tool.
- Use structured logging without note content, secrets, prompts, or absolute vault paths unless an approved diagnostic mode explicitly permits it.
- Add or update deterministic tests before behavior changes. Put non-deterministic quality checks in `evals/`, not brittle unit tests.
- Update contracts, ADRs, plans, and `docs/progress.md` when their authority changes.

## Commands

Run the narrowest relevant command first, then the full completion gate for a phase or user-facing change.

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
npm run eval:smoke
npm run eval:full
npm run security:check
```

## Completion Gate

Do not claim a task complete until its acceptance criteria were reviewed, relevant tests/evals and static/build checks were run, documentation is current, and no unresolved critical finding remains. State any unavailable verification explicitly.

## Agent skills

- Load one workflow skill for the process and the matching Vault Steward skill for repository rules.
- Vault Steward skills override generic advice on architecture, safety, test/eval placement, commands, and completion gates.
- If uncertain which workflow applies, invoke `ask-matt`; do not improvise a new process.

| Situation                                                                  | Workflow skill                  | Required companion                                                                       |
| -------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| New or materially changed product idea                                     | `grill-with-docs`               | `domain-modeling` when terms/ADRs change, plus the relevant Vault Steward skill          |
| Glossary term or hard-to-reverse architecture decision                     | `domain-modeling`               | relevant authoritative docs and `docs/decisions/`                                        |
| Module interface, seam, testability, or dependency shape                   | `codebase-design`               | `vault-steward-typescript`                                                               |
| Broad codebase architecture-health survey explicitly requested by the user | `improve-codebase-architecture` | `codebase-design` and `vault-steward-typescript`                                         |
| Approved TypeScript/Preact/Obsidian/storage/review/apply implementation    | `implement` + `tdd`             | `vault-steward-typescript` and `vault-steward-testing-evals`                             |
| Approved provider/agent/prompt/evidence/structured-output implementation   | `implement` + `tdd`             | `vault-steward-ai-workflows` and `vault-steward-testing-evals`                           |
| Hard bug or performance regression with reproducible failure               | `diagnosing-bugs`               | relevant Vault Steward implementation skill and focused test                             |
| Completed branch, PR, or worktree diff before landing                      | `code-review`                   | originating plan/spec plus relevant Vault Steward skill                                  |
| Changing Obsidian/provider/API/security fact requiring primary sources     | `research`                      | `vault-steward-ai-workflows` for provider facts, otherwise relevant targeted skill       |
| One uncertain state-model or UI interaction question                       | `prototype`                     | relevant targeted skill; prototype is evidence, never production authority               |
| Human-only credential, dashboard, consent, or provider setup               | `wizard`                        | security/privacy docs and `vault-steward-ai-workflows` when a model provider is involved |
| Skill, `AGENTS.md`, or agent-facing instruction change                     | `writing-for-agents`            | existing project conventions                                                             |
| Transfer to another session, directory, harness, or collaborator           | `handoff`                       | links to existing spec/plan/ADR rather than copied content                               |

### Repository-specific skills

- `vault-steward-typescript`: TypeScript, Preact, Obsidian, scanner, storage, policy, review, proposal, approval, and apply modules.
- `vault-steward-ai-workflows`: providers, agents, prompts, evidence bundles, structured output, tool permissions, model recovery.
- `vault-steward-testing-evals`: deterministic tests, fixtures, eval datasets, graders, baselines, performance/operational/release gates.

### Routing constraints

- The user declined the Matt issue-tracker/ticket flow; do not invoke `to-tickets`, `triage`, `wayfinder`, or tracker setup unless the user later asks.
- Scoped phase implementation must not trigger `improve-codebase-architecture` or unrelated refactoring; use it only for an explicit architecture-health request.
- `prototype` output never bypasses contracts, ADRs, tests, or approval gates.
- ADRs live in `docs/decisions/`, not `docs/adr/`; phase plans and branch gates remain authoritative.
- Project skills live in `.devin/skills/`; `skills-lock.json` records provenance. Do not edit vendored skills directly; update through the skills CLI or the local source under `skills/`.
