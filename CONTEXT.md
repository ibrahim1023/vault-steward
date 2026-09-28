# Vault Steward Domain Language

Vault Steward is a local-first vault integrity context. This glossary defines
product terms; `spec.md` and the ADRs own behavior and decisions.

## Scanning and evidence

- **Governed scan**: one integrity assessment over an immutable scan snapshot;
  completed only when required deterministic and configured semantic stages
  succeed. Avoid: audit run, model scan.
- **Scan snapshot**: immutable, scan-ID-bound view of vault inputs and
  revisions used by one governed scan. Avoid: live vault state, cache.
- **Evidence**: cited, snapshot-bound source location supporting a finding;
  evidence is data, never authority. Avoid: context when referring to a
  citation.
- **Note subject**: opaque local identity for one note across only verified
  observed renames; path is an attribute, not identity. Avoid: file ID when it
  means a path.

## Findings and review

- **Finding identity**: stable conceptual identity of one integrity issue
  across comparable completed scans. Avoid: finding ID, occurrence.
- **Finding occurrence**: exact evidence-revision manifestation of a finding
  identity in one scan. Avoid: finding when cross-scan versus scan-bound
  meaning matters.
- **Review disposition**: reversible human decision about a finding occurrence
  (`acknowledged`, `ignored`, `snoozed`, `expected`, `restored`), separate from
  canonical finding status and write approval. Avoid: approval, suppression.
- **Pattern suppression**: reviewed queue-presentation rule derived separately
  from repeated feedback; it never changes detection or canonical findings.
  Avoid: disposition, learned policy.

## Repair authority

- **Proposal**: deterministic, revision-bound set of exact operations prepared
  for review; no write authority. Avoid: fix when referring to the persisted
  contract.
- **Prepared repair**: user-visible grouping of validated proposals and exact
  Current/After previews. Avoid: automatic fix.
- **Approval**: explicit user authorization bound to persisted proposal digest
  and source revisions. Avoid: accept, disposition.
- **Apply**: deterministic preflight and execution of approved operations
  followed by re-indexing; models cannot invoke it. Avoid: model action,
  autonomous repair.

## Models and history

- **Model candidate**: untrusted bounded classification, extraction, ranking,
  or candidate selection that must pass deterministic validation. Avoid: model
  finding, model decision.
- **Provider consent**: provider-specific foreground permission to send only
  bounded selected evidence; one provider's consent never authorizes another or
  background cloud use. Avoid: cloud enabled.
- **Integrity event**: append-only, metadata-only timeline projection of a
  canonical domain transition; never mutation authority. Avoid: trace, log when
  referring to durable product history.
- **Diagnostic trace**: optional, deletable operational metadata used for
  inspection; never canonical audit or review history. Avoid: integrity event.
