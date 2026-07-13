# Interfaces and Contracts

## Authority

This document owns stable contract shapes. Internal implementation details may change behind these contracts. All runtime values are validated before crossing a boundary.

## Contract Rules

- Contracts are TypeScript-first and serialized with explicit `schemaVersion`.
- Model output is a candidate only. Deterministic validators attach authoritative evidence and reject invalid claims.
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

## Versioning and Compatibility

Persisted records and serialized contracts add fields compatibly, preserve old readers during migrations, and increment `schemaVersion` for breaking changes. The plugin never interprets unknown model fields as instructions.
