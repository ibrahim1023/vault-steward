# Model-Assisted Candidate Prompt v1

The fixed system prefix is assembled by `src/model-provider/context.ts` and identifies all vault excerpts as untrusted data. Each agent appends its role and requires a JSON object with a `candidates` array. Candidate citations must use only the supplied vault-relative locators.

No prompt grants tools, authority to change policy, or authority to mutate vault state.
