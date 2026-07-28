# AI and Multi-Agent System

## Authority

This document owns agent roles, model boundaries, budgets, and guardrails. Evaluation requirements are in `docs/evaluation-plan.md`.

## Operating Model

The scanner, graph builder, reference integrity checks, task parsing, schema validation, policy evaluation, diff generation, outcome calculation, approval, and apply workflow are deterministic. The selected model provider performs the required semantic-analysis stage for governed scans, identifying candidate entities, propositions, staleness signals, or ranked evidence. For repair recommendations, it may choose an ID from a bounded list of target notes derived from the active immutable snapshot, or abstain. Ollama and llama.cpp remain local; OpenAI requires an explicit cloud-data acknowledgement. Every model result is schema-validated and evidence-checked before it becomes a finding or recommendation.

| Agent         | Input                              | Output                           | Model use                        |
| ------------- | ---------------------------------- | -------------------------------- | -------------------------------- |
| Scanner       | vault files                        | normalized records               | none                             |
| Entity        | canonical graph and labels         | duplicate/alias candidates       | required                         |
| Contradiction | bounded propositions and citations | conflict candidates              | expected                         |
| Staleness     | timestamps, status, linked context | stale candidates                 | required                         |
| Reference     | parsed links and vault index       | broken-reference findings        | none                             |
| Task          | parsed tasks and graph             | task findings                    | required for ambiguous ownership |
| Schema        | frontmatter and schema             | violations                       | none                             |
| Decision      | decision records and links         | unresolved/superseded candidates | required                         |
| Policy        | typed facts and YAML rules         | violations                       | none                             |
| Coordinator   | validated candidates               | ranked recommendation set        | none                             |
| Repair guide  | bounded target IDs                 | selected target ID or abstention | bounded                          |

## Workflow Controls

- Each agent receives a `scanId`, bounded evidence bundle, policy context, output schema, and budget.
- Coordinator routes only after deterministic eligibility checks and caps each agent to one attempt plus one repair attempt for malformed structured output.
- No agent calls another agent directly. Coordinator owns handoffs and stores only declared shared context.
- Terminate on a complete typed response, exhausted budget, missing evidence, policy failure, or timeout. Mark incomplete work visibly.
- A completed governed scan requires an available configured provider and successful bounded semantic-analysis stage. Provider absence or structured-output exhaustion leaves the scan incomplete; it never degrades to a deterministic-only completion.
- Structured model output is parsed as JSON, validated against the receiving contract, and may receive one repair attempt. Traces retain provider/model, latency, retry count, and outcome only; they never retain prompts or note excerpts.
- Evidence context has a fixed untrusted-data prefix, vault-relative locators, entry and token limits, and excludes private entries before a provider call.
- A repair model sees candidate IDs and metadata only. Unknown IDs, cross-scan
  candidates, malformed output, and unsupported operations are rejected.
- Deterministic code constructs every patch range, expected result, approval
  record, and write operation. Model output never supplies mutation authority.

## Security and Evidence

Treat note content as untrusted data. Prompts must label it as data, never instructions. Agents cannot access shell, arbitrary filesystem paths, or write tools. Provider adapters may access only their configured Ollama/llama.cpp loopback endpoint or the fixed OpenAI API origin after explicit opt-in. A finding needs source locators that resolve to the active scan snapshot. Final severity, policy violation, proposal, expected result, approval, and apply decisions remain deterministic.

## Runtime Budgets

Initial defaults are configuration, not promises: one concurrent model request; 30-second request timeout; 2 model calls per agent per scan; 8K input and 1K output token maxima; 24K aggregate model-input tokens per scan. Record actual token estimates, latency, retries, retrieved-context utilization, and tool calls for later tuning.

## Governed Scan Input Boundary

`src/core/governed-scan.ts` constructs each model request from the immutable scanner snapshot. It supplies bounded note evidence, deterministic contradiction propositions, staleness records, and decision records to the coordinator. The core result includes metadata-only model traces and limitations; a required model-stage failure returns an incomplete scan with no completed finding set.
