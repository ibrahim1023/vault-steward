import {
  FINDING_TYPES,
  type EvidenceRef,
  type Finding,
  type FindingSeverity,
  type FindingType
} from "../contracts/index.js";

export type NormalizedFindingInput = {
  scanId: string;
  type: FindingType;
  severity: FindingSeverity;
  evidence: readonly EvidenceRef[];
  availableEvidence: readonly EvidenceRef[];
  explanation: string;
  confidence: number;
  violatedPolicyId?: string;
};

export function normalizeFinding(input: NormalizedFindingInput): Finding | null {
  if (
    input.scanId.length === 0 ||
    !FINDING_TYPES.includes(input.type) ||
    input.evidence.length === 0 ||
    input.confidence < 0 ||
    input.confidence > 1 ||
    input.explanation.trim().length === 0 ||
    !input.evidence.every((evidence) => containsEvidence(input.availableEvidence, evidence))
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    id: stableFindingId(input),
    scanId: input.scanId,
    type: input.type,
    severity: input.severity,
    evidence: [...input.evidence],
    affectedNoteIds: uniquePaths(input.evidence),
    ...(input.violatedPolicyId ? { violatedPolicyId: input.violatedPolicyId } : {}),
    explanation: input.explanation,
    suggestedFixes: [],
    confidence: input.confidence,
    status: "open"
  };
}

function containsEvidence(available: readonly EvidenceRef[], candidate: EvidenceRef): boolean {
  return available.some((evidence) => evidenceKey(evidence) === evidenceKey(candidate));
}

function uniquePaths(evidence: readonly EvidenceRef[]): string[] {
  return [...new Set(evidence.map((item) => item.notePath))];
}

function stableFindingId(input: NormalizedFindingInput): string {
  const value = [
    input.scanId,
    input.type,
    input.severity,
    input.confidence.toString(),
    input.evidence.map(evidenceKey).join("|")
  ].join(":");
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${input.scanId}:finding:${(hash >>> 0).toString(16)}`;
}

function evidenceKey(evidence: EvidenceRef): string {
  return `${evidence.notePath}:${evidence.locator}:${evidence.excerpt}`;
}
