# ADR 0008: Stable Finding Identity and Snapshot-Bound Occurrences

## Status

Accepted on 2026-09-28. Storage foundation implemented: the identity and
occurrence contracts, migration 12 tables, repository persistence, and the
legacy `v0` backfill. Detector identity adapters and runtime occurrence wiring
remain pending; the rest of this ADR's behavior is not yet shipped.

## Context

Finding IDs are currently scan-scoped and include mutable presentation and
evidence material, and the current lifecycle groups serialized evidence. That
identity cannot safely support cross-scan Changes, recurrence tracking, Inbox
dispositions, snooze semantics, or rename continuity.

ADR 0005's unified evidence-validation boundary remains unchanged: the
normalizer is still the sole promotion boundary and model output still cannot
become a finding without deterministic evidence validation. This ADR supersedes
only ADR 0005's statement that the normalizer creates IDs from scan-scoped
typed evidence.

ADR 0003's snapshot binding remains unchanged for occurrences, proposals, and
apply: evidence and source revisions still gate preview and apply.

## Decision

### Contracts

Stable identity and snapshot-bound occurrences are separate records:

```ts
type FindingIdentity = {
  schemaVersion: 1;
  identityVersion: 1;
  stableKey: string;
  family: FindingType;
  subtype: string;
  detectorId: string;
  detectorVersion: string;
  policyId?: string;
  policyVersion?: string;
  subjectIds: readonly string[];
  semanticKey: string;
};

type FindingOccurrence = {
  schemaVersion: 1;
  occurrenceId: string;
  stableKey: string;
  scanId: string;
  evidenceRevisionKey: string;
  findingId: string;
};
```

### Identity rules

- The generic normalizer must never infer identity from explanation text or
  model prose. Each deterministic finding-family adapter supplies bounded,
  runtime-validated canonical identity parts; model candidates can only select
  or cite evidence and cannot define identity parts.
- Canonical stable-key input order: `identityVersion`, family, subtype,
  detector ID and version, optional policy ID and version, sorted immutable
  subject IDs, then `semanticKey`. Serialize with an unambiguous versioned
  canonical encoding and hash with SHA-256. Prefix `finding:v1:`. Sorting
  applies only to semantically unordered sets; ordered roles, for example
  contradiction left/right when meaningful, must be role-labelled before
  canonicalization.
- Stable identity excludes scan ID, occurrence and finding row IDs, severity,
  confidence, status and disposition, explanation and model phrasing, excerpts,
  source revisions, timestamps, rank, and display labels.
- `semanticKey` is a detector-owned bounded structural discriminator such as
  rule ID plus a normalized target, field, task, decision, or entity relation.
  It is not arbitrary model text and must not contain note bodies, excerpts,
  absolute paths, URLs, secrets, or prompts.
- Evidence locators remain required occurrence evidence but are excluded from
  stable identity unless a detector has no safer semantic discriminator. Any
  detector fallback must use a versioned normalized structural locator rather
  than excerpt text, and moving that structure may intentionally fork identity.
  The implementation plan must enumerate identity adapters for every currently
  supported finding family before migration.
- `occurrenceId` uses prefix `occurrence:v1:` and is the SHA-256 of stable key,
  scan ID, and `evidenceRevisionKey`. `findingId` remains the existing persisted
  occurrence-row and proposal foreign key during migration; it is not the
  cross-scan key.
- `evidenceRevisionKey` is the SHA-256 over sorted role-labelled evidence
  subjects including immutable subject ID, normalized locator, and source
  revision. It excludes excerpts and changes whenever evidence revision or
  structural locator changes.

### Note subjects and rename

- Introduce an immutable local opaque note subject ID persisted separately from
  path, plus a path history.
- First observation assigns a random UUID; stable keys use subject IDs, never
  raw paths.
- A subject is preserved across rename only for a bounded, unambiguous Obsidian
  rename event observed while the plugin is loaded and persisted before the
  next scan, with exactly one old subject and one safe new normalized path. A
  pure verified rename preserves the subject.
- Never infer rename continuity from matching content, revision, or hash alone.
  External, offline, unobserved, or ambiguous rename creates a new subject and
  therefore new stable identities; do not silently merge later.
- Delete closes the current path binding but never reuses the subject ID for
  another note.

### Disposition semantics

- Disposition records reference `stableKey`, `sourceOccurrenceId`, and
  `sourceEvidenceRevisionKey`; append-only disposition events record
  acknowledged, ignored, snoozed, expected, and restored.
- Ignored, expected, and acknowledged apply to that evidence revision only;
  materially changed evidence produces a due occurrence again. These are not
  pattern suppressions.
- Every snooze ends at its date or earlier when `evidenceRevisionKey` changes.
  `untilEvidenceChanges` has no date and ends only on evidence change or
  restore.
- A pure verified rename preserves the subject and, if locator and content
  revision inputs are otherwise unchanged, must not wake a snooze. Because
  current whole-file revisions may change on rename depending on adapter
  behavior, implementation tests must explicitly establish the pure-rename
  revision rule rather than assume it.
- Unverified rename forks identity and does not carry disposition.
- Restored appends a reversal event; prior history is never mutated.

### Comparison semantics

- Compare completed compatible scans only.
- Same `stableKey` and same `evidenceRevisionKey` is unchanged; same
  `stableKey` and a different `evidenceRevisionKey` is changed; a `stableKey`
  absent from a later completed comparable scan is resolved; reappearance after
  resolved is recurring; a new `stableKey` is new.
- Incomplete, failed, or canceled scans produce no resolved transitions.
- Multiple occurrences of one stable key in one scan are permitted only when
  role-labelled semantic or evidence discriminators keep occurrence IDs unique;
  exact duplicate occurrences are rejected.

## Migration or reversal strategy

- Forward-only additive migration. Keep existing finding IDs, foreign keys,
  proposals, and approvals.
- Add identity and occurrence records and columns plus subject and path-history
  tables; do not rewrite proposal digests or historical approval authority.
- Backfill existing findings as `identityVersion: 0` legacy occurrences using
  bounded existing metadata per row. Do not merge legacy rows across scans
  because historic rename and semantic identity cannot be proven. Cross-scan
  Changes begin at the first completed v1-identity scan; the UI labels earlier
  history as legacy and non-comparable.
- Reviewer feedback remains attached to its historical finding occurrence. No
  legacy feedback automatically becomes a pattern suppression.

## Alternatives considered

- Keep the current scan-scoped finding ID as the cross-scan key — rejected: it
  embeds mutable evidence and presentation material.
- Hash explanation text or excerpts for identity — rejected: model phrasing and
  excerpt drift would fork identity on irrelevant edits.
- Use the file path alone as subject identity — rejected: renames would sever
  all continuity.
- Infer rename continuity from content, revision, or hash matching — rejected:
  ambiguous matches would silently merge distinct notes.
- Let models select or propose identity parts — rejected: model output is
  untrusted and unstable across versions.

## Consequences

- Every supported finding family needs a bounded identity adapter, and subject
  mapping plus path history become new persisted state.
- Storage grows additively; cross-scan comparison joins on `stableKey`.
- Identity construction fails closed: a finding without complete validated
  identity parts is not persisted.

## Required tests

- Canonical-encoding and hashing property tests.
- An identity adapter test for every currently supported finding family.
- Unordered-set sorting versus ordered role-labelled discriminators.
- Restart persistence of identity, occurrence, subject, and disposition state.
- Duplicate-occurrence rejection and permitted multi-occurrence cases.
- Changed-evidence recurrence of ignored, expected, and acknowledged findings.
- Completed-only comparison; incomplete scans produce no resolved transitions.
- Observed unambiguous rename preserves subject and snooze; external,
  unobserved, and ambiguous rename forks identity.
- Delete closes the path binding without subject reuse.
- Snooze expiry, `untilEvidenceChanges`, and restore reversal behavior.
- Legacy backfill produces `identityVersion: 0` occurrences and leaves proposal
  and approval digests unchanged.
