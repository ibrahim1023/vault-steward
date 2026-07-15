# Interfaces and Contracts

## Authority

This document owns stable contract shapes. Internal implementation details may change behind these contracts. All runtime values are validated before crossing a boundary.

## Contract Rules

- Contracts are TypeScript-first and serialized with explicit `schemaVersion`.
- Model output is a candidate only. Deterministic validators attach authoritative evidence and reject invalid claims.
- A governed scan requires the local model-analysis stage to complete. `modelAvailable: false` or `completed: false` is a terminal incomplete state, not permission to omit semantic analysis.
- Errors have a machine-readable code, user-safe message, correlation ID, retryability, and optional causal detail for local diagnostics.

## Core Shapes

```ts
type Finding = {
  schemaVersion: 1;
  id: string;
  scanId: string;
  type: FindingType;
  severity: "info" | "low" | "medium" | "high" | "critical";
  evidence: EvidenceRef[];
  affectedNoteIds: string[];
  violatedPolicyId?: string;
  explanation: string;
  suggestedFixes: SuggestedFix[];
  confidence: number; // 0..1
  status: "open" | "dismissed" | "approved" | "applied" | "stale";
};

type NormalizedFindingInput = {
  scanId: string;
  type:
    | "broken-reference"
    | "invalid-reference"
    | "entity-alias"
    | "contradiction"
    | "staleness"
    | "task"
    | "schema"
    | "decision"
    | "policy";
  evidence: EvidenceRef[];
  availableEvidence: EvidenceRef[]; // immutable active scan evidence
  confidence: number; // 0..1
  severity: FindingSeverity;
  explanation: string;
};

type AgentRequest = {
  schemaVersion: 1;
  scanId: string;
  agent: AgentName;
  evidence: EvidenceBundle;
  policyContext: PolicyContext;
  budget: { maxInputTokens: number; maxOutputTokens: number; timeoutMs: number };
};

type AgentCandidate = {
  schemaVersion: 1;
  candidateFindings: CandidateFinding[];
  incomplete: boolean;
  limitations: string[];
};

type ToolResult<T> =
  | { ok: true; value: T; correlationId: string }
  | { ok: false; error: VaultStewardError; correlationId: string };
```

## Proposal Contracts

`Proposal` is a versioned, review-only request bound to a finding and scan. The current patch operation is `replace-range`: it names a vault-relative Markdown path, source revision, byte offsets, expected current text, and replacement text. Unknown operation kinds, traversal paths, invalid ranges, and missing expected text are rejected before a proposal can reach approval or apply.

Approval actions are append-only records. Only a pending proposal can be approved, dismissed, or deferred. The apply workflow accepts only an approved proposal, re-reads every affected file, verifies its revision and expected text, then writes through the narrow vault adapter. Any mismatch marks the proposal stale; failed or interrupted apply attempts require explicit recovery.

## Tool Permissions

Agents receive only read-scoped tools: retrieve indexed evidence, resolve paths within the active vault, and inspect parsed policy/graph data. The apply tool is not agent-callable; it is invoked by the review workflow only after explicit approval and stale-revision validation.

## Unified Finding Normalization

`src/findings/normalize.ts` is the only boundary that promotes deterministic issues or local-model candidates into a unified `Finding`. It accepts only a supported type, finite confidence in the inclusive `0..1` range, a non-empty explanation, and evidence that exactly matches an item in the immutable active scan. Unknown model fields, uncited candidates, and unsupported issue types are discarded. Model output never directly becomes a finding or proposal.

## Versioning and Compatibility

Persisted records and serialized contracts add fields compatibly, preserve old readers during migrations, and increment `schemaVersion` for breaking changes. The plugin never interprets unknown model fields as instructions.

## Incremental Scan Contract

`VaultEvent` is a versioned, vault-relative event record. `planIncrementalScan` may return an incremental plan only for bounded, safe Markdown modify events. Rename, delete, create, malformed paths, empty queues, and event overflow return a full scan plan; correctness takes precedence over work reduction.

`ParseProduct` stores only a normalized path, revision hash, parser version, metadata hashes, and typed dependency targets. It is reusable only for the exact parser version and revision. The active process may reuse its immutable parsed note; SQLite does not retain historical note bodies to reconstruct parse state after restart.

`ChangeImpact` reports affected inbound references, aliases, task/decision/policy dependencies, and deterministic wiki-link rewrites. It never writes the vault. A rewrite is supplied only for an exact internal wiki target, while Markdown links, embeds, ambiguous aliases, and delete events remain review-only impact records.

`FindingLifecycleRecord` contains aggregate type/evidence-key state: first and last completed observation, recurrence count, stale state, and whether the finding was absent from a later completed scan. History UI renders only aggregate state and timestamps, never the persisted evidence payload.
