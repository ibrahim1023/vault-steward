# AI and Multi-Agent System

## Authority

This document owns agent roles, model boundaries, budgets, and guardrails. Evaluation requirements are in `docs/evaluation-plan.md`.

## Operating Model

The scanner, graph builder, reference integrity checks, task parsing, schema validation, policy evaluation, diff generation, and apply workflow are deterministic. Local models may identify candidate entities, propositions, staleness signals, or ranked evidence where deterministic logic is insufficient. Every model result is schema-validated and evidence-checked before it becomes a finding.

| Agent         | Input                              | Output                           | Model use                        |
| ------------- | ---------------------------------- | -------------------------------- | -------------------------------- |
| Scanner       | vault files                        | normalized records               | none                             |
| Entity        | canonical graph and labels         | duplicate/alias candidates       | optional                         |
| Contradiction | bounded propositions and citations | conflict candidates              | expected                         |
| Staleness     | timestamps, status, linked context | stale candidates                 | optional                         |
| Reference     | parsed links and vault index       | broken-reference findings        | none                             |
| Task          | parsed tasks and graph             | task findings                    | optional for ambiguous ownership |
| Schema        | frontmatter and schema             | violations                       | none                             |
| Decision      | decision records and links         | unresolved/superseded candidates | optional                         |
| Policy        | typed facts and YAML rules         | violations                       | none                             |
| Coordinator   | validated candidates               | deduped review queue             | none                             |

## Workflow Controls

- Each agent receives a `scanId`, bounded evidence bundle, policy context, output schema, and budget.
- Coordinator routes only after deterministic eligibility checks and caps each agent to one attempt plus one repair attempt for malformed structured output.
- No agent calls another agent directly. Coordinator owns handoffs and stores only declared shared context.
- Terminate on a complete typed response, exhausted budget, missing evidence, policy failure, or timeout. Mark incomplete work visibly.
- Local provider fallback is ordered by configured model capability; failure degrades to deterministic findings and an explicit limitation.

## Security and Evidence

Treat note content as untrusted data. Prompts must label it as data, never instructions. Agents cannot access network, shell, arbitrary filesystem paths, or write tools. A finding needs source locators that resolve to the active scan snapshot. The final severity, policy violation, and proposal are deterministic coordinator decisions.

## Runtime Budgets

Initial defaults are configuration, not promises: one concurrent model request; 30-second request timeout; 2 model calls per agent per scan; 8K input and 1K output token maxima; 24K aggregate model-input tokens per scan. Record actual token estimates, latency, retries, retrieved-context utilization, and tool calls for later tuning.
