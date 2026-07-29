# Context Map

Load the smallest context that permits a correct change. `AGENTS.md`, the assigned plan, and relevant source/tests precede broad document reading.

| Task                      | Read                                                 | Load skill                    | Usually avoid                              | Checks                                  |
| ------------------------- | ---------------------------------------------------- | ----------------------------- | ------------------------------------------ | --------------------------------------- |
| parser/graph/policy       | architecture, data model, interfaces, testing        | `vault-steward-typescript`    | AI/eval docs unless model boundary changes | planned unit/integration/typecheck      |
| UI/review workflow        | architecture, interfaces, security, testing          | `vault-steward-typescript`    | full evaluation plan                       | planned UI/e2e/typecheck                |
| storage/migration         | data model, interfaces, reliability, testing         | `vault-steward-typescript`    | prompt guidance                            | planned migration/integration/typecheck |
| agent/prompt/provider     | AI system, interfaces, security, evaluation          | `vault-steward-ai-workflows`  | unrelated UI docs                          | planned eval smoke/security/typecheck   |
| eval change               | evaluation plan, AI system, testing, release quality | `vault-steward-testing-evals` | broad product interpretation               | planned eval commands                   |
| security-sensitive change | security plus affected contract                      | relevant targeted skill       | unrelated plans                            | planned security + affected suite       |
| bug fix/review            | task plan, contract, failing test                    | targeted skill                | unrelated architecture                     | exact reproducer + affected checks      |

Search symbols before opening large files. Summarize inspected patterns in the task record. Do not repeatedly load unchanged documents, entire repositories, or unrelated skills. Subagents, when used, receive only their bounded objective, listed files/contracts, acceptance criteria, and verification commands.
