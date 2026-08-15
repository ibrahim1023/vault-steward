# Duplicate Entity Canonical Review Design

## Decision

Vault Steward uses bounded link-and-alias consolidation for duplicate-entity
findings. It does not merge, delete, rename, or otherwise rewrite either note.

## User Flow

1. A duplicate finding opens a comparison of the two cited notes.
2. The provider may recommend either snapshot-bound note as canonical or abstain.
3. The user chooses the canonical note.
4. Vault Steward presents every exact inbound-reference and eligible alias edit.
5. One explicit approval applies the revision-bound batch and re-indexes the vault.

## Boundaries

- A provider receives only the two candidate IDs and bounded metadata.
- Deterministic code resolves references, builds Markdown syntax, calculates the
  preview, validates revisions and digests, and performs writes.
- Only references that resolve unambiguously to the selected duplicate change.
- Only aliases held by the duplicate and no third note transfer.
- Visible link labels, anchors, embed markers, source-relative paths, and both
  note bodies remain unchanged.

## Rejected Alternatives

- Automatic canonical selection: no explicit user decision.
- Semantic note merge: unreliable, difficult to preview, and too broad.
- Delete duplicate note: risks data loss and breaks intentional historical use.
