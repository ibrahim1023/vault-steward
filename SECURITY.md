# Security

Vault Steward treats vault content and model output as untrusted input. Deterministic validation owns evidence, policy, proposal, approval, and apply authority.

## Reporting A Vulnerability

Do not publish a vulnerability with vault content, proof-of-concept notes, or secrets in a public issue. Use the repository's private vulnerability-reporting route when available; otherwise contact the repository owner privately before disclosure.

## Protections

- Vault access is limited to normalized vault-relative paths through the Obsidian adapter.
- Ollama and llama.cpp provider endpoints are restricted to loopback configuration. HyperFusion and OpenAI are fixed-origin, explicit opt-in providers that require a local API key and cloud-data acknowledgement.
- Model output is parsed against typed schemas, citation-checked, size-bounded, and cannot mutate state directly.
- Prepared edits require one explicit **Apply N fixes** approval and a
  revision-safe preflight of every batch member before the first write.
- Invalid policy loading and rollback failures fail closed: no additional edit
  is applied until the problem is recovered and reviewed.
- Models may choose only bounded candidate IDs or abstain. Deterministic code
  owns patch construction, outcome calculation, approval, and writes.
- Evaluation and trace records exclude sensitive content by default.
- Dependency auditing is part of the repository completion gate.

Read the [full threat model](docs/security.md) for the detailed controls and
trust boundaries.
