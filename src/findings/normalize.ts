import { createHash } from "node:crypto";

import {
  createEvidenceRevisionKey,
  createFindingOccurrence,
  FINDING_TYPES,
  parseFindingIdentity,
  type EvidenceRef,
  type FindingIdentity,
  type FindingSeverity,
  type FindingType,
  type FindingV2,
  type SuggestedFix
} from "../contracts/index.js";
import { normalizeStructuralLocator } from "./identity.js";

export type PromotedEvidence = EvidenceRef & {
  role: string;
  subjectId: string;
  sourceRevision: string;
};

export type NormalizedFindingInput = {
  scanId: string;
  type: FindingType;
  severity: FindingSeverity;
  identity: FindingIdentity;
  evidence: readonly PromotedEvidence[];
  availableEvidence: readonly EvidenceRef[];
  explanation: string;
  confidence: number;
  violatedPolicyId?: string;
  suggestedFixes?: readonly SuggestedFix[];
  affectedNoteIds?: readonly string[];
};

export function normalizeFinding(input: NormalizedFindingInput): FindingV2 | null {
  if (
    input.scanId.length === 0 ||
    !FINDING_TYPES.includes(input.type) ||
    input.evidence.length === 0 ||
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1 ||
    input.explanation.trim().length === 0 ||
    !input.evidence.every((evidence) => containsEvidence(input.availableEvidence, evidence))
  ) {
    return null;
  }
  const affectedNoteIds = input.affectedNoteIds ?? uniquePaths(input.evidence);
  if (
    affectedNoteIds.length === 0 ||
    new Set(affectedNoteIds).size !== affectedNoteIds.length ||
    !affectedNoteIds.every((path) =>
      input.availableEvidence.some((evidence) => evidence.notePath === path)
    )
  ) {
    return null;
  }

  const parsed = parseFindingIdentity(input.identity);
  if (!parsed.ok || parsed.value.family !== input.type) return null;
  const identity = parsed.value;

  try {
    const evidenceRevisionKey = createEvidenceRevisionKey(
      input.evidence.map((evidence) => ({
        role: evidence.role,
        subjectId: evidence.subjectId,
        locator: normalizeStructuralLocator(evidence.locator),
        sourceRevision: evidence.sourceRevision
      }))
    );
    const id = `finding-row:v1:${createHash("sha256")
      .update(JSON.stringify([identity.stableKey, input.scanId, evidenceRevisionKey]))
      .digest("hex")}`;
    const occurrence = createFindingOccurrence({
      stableKey: identity.stableKey,
      scanId: input.scanId,
      evidenceRevisionKey,
      findingId: id
    });

    return {
      schemaVersion: 2,
      id,
      scanId: input.scanId,
      type: input.type,
      severity: input.severity,
      evidence: input.evidence.map((evidence) => ({
        notePath: evidence.notePath,
        locator: evidence.locator,
        excerpt: evidence.excerpt
      })),
      affectedNoteIds: [...affectedNoteIds],
      ...(input.violatedPolicyId ? { violatedPolicyId: input.violatedPolicyId } : {}),
      explanation: input.explanation,
      suggestedFixes: [...(input.suggestedFixes ?? [])],
      confidence: input.confidence,
      status: "open",
      identity,
      stableKey: identity.stableKey,
      occurrenceId: occurrence.occurrenceId,
      evidenceRevisionKey
    };
  } catch {
    return null;
  }
}

function containsEvidence(available: readonly EvidenceRef[], candidate: EvidenceRef): boolean {
  return available.some((evidence) => evidenceKey(evidence) === evidenceKey(candidate));
}

function uniquePaths(evidence: readonly EvidenceRef[]): string[] {
  return [...new Set(evidence.map((item) => item.notePath))];
}

function evidenceKey(evidence: EvidenceRef): string {
  return `${evidence.notePath}:${evidence.locator}:${evidence.excerpt}`;
}
