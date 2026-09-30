import { createHash } from "node:crypto";

import { createFindingIdentity, type FindingIdentity } from "../contracts/index.js";
import type { DecisionIssueKind } from "../decisions/index.js";
import type { TaskIssueKind } from "../tasks/check.js";

const DETECTOR_VERSION = "1";

const DETECTOR_IDS = [
  "reference-integrity",
  "reference-normalization",
  "task-integrity",
  "schema-integrity",
  "decision-integrity",
  "policy-integrity",
  "entity-alias",
  "contradiction",
  "semantic-staleness",
  "change-aware-maintenance"
] as const;

export type ReferenceIdentityInput = {
  family: "broken-reference" | "invalid-reference" | "reference-normalization";
  subtype:
    | "invalid"
    | "ambiguous"
    | "missing"
    | "missing-anchor"
    | "verified-rename"
    | "confirmed-canonical";
  sourceSubjectId: string;
  targetSubjectId?: string;
  normalizedTarget: string;
};

export type TaskIdentityInput = {
  subjectId: string;
  issueKind: TaskIssueKind;
  taskId?: string;
  structuralLocator: string;
};

export type SchemaIdentityInput = {
  subjectId: string;
  template: string;
  field: string;
  rule: string;
};

export type DecisionIdentityInput = {
  subjectId: string;
  issueKind: DecisionIssueKind | "semantic-review";
  decisionId: string;
};

export type PolicyIdentityInput = {
  subjectId: string;
  policyId: string;
  policyVersion: string;
  ruleId: string;
};

export type EntityAliasIdentityInput = {
  subjectIds: readonly [string, string];
};

export type ContradictionIdentityInput = {
  left: { subjectId: string; structuralLocator: string };
  right: { subjectId: string; structuralLocator: string };
  symmetric: boolean;
};

export type SemanticStalenessIdentityInput = {
  subjectId: string;
  ruleId: string;
};

export type MaintenanceIdentityInput = {
  subtype: "rename" | "delete" | "superseded-decision";
  sourceSubjectId: string;
  targetSubjectId: string;
  dependencyKind?: "reference" | "task" | "decision" | "policy";
};

export const FINDING_IDENTITY_PROFILE_HASH: string = createHash("sha256")
  .update(
    JSON.stringify([
      1,
      [...DETECTOR_IDS]
        .sort((left, right) => left.localeCompare(right))
        .map((detectorId) => [detectorId, DETECTOR_VERSION])
    ])
  )
  .digest("hex");

export function normalizeStructuralLocator(locator: string): string {
  return locator.trim().replace(/\s+/g, " ");
}

export function createReferenceFindingIdentity(input: ReferenceIdentityInput): FindingIdentity {
  return createFindingIdentity({
    identityVersion: 1,
    family: input.family,
    subtype: input.subtype,
    detectorId:
      input.family === "reference-normalization"
        ? "reference-normalization"
        : "reference-integrity",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: uniqueSubjects(
      input.targetSubjectId === undefined
        ? [input.sourceSubjectId]
        : [input.sourceSubjectId, input.targetSubjectId]
    ),
    semanticKey: canonicalJson({ target: input.normalizedTarget })
  });
}

export function createTaskFindingIdentity(input: TaskIdentityInput): FindingIdentity {
  const explicitTaskId =
    input.taskId !== undefined && !/^line-\d+$/.test(input.taskId) ? input.taskId : undefined;
  return createFindingIdentity({
    identityVersion: 1,
    family: "task",
    subtype: input.issueKind,
    detectorId: "task-integrity",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: [input.subjectId],
    semanticKey: canonicalJson({
      kind: input.issueKind,
      ref: explicitTaskId ?? `locator:v1:${normalizeStructuralLocator(input.structuralLocator)}`
    })
  });
}

export function createSchemaFindingIdentity(input: SchemaIdentityInput): FindingIdentity {
  return createFindingIdentity({
    identityVersion: 1,
    family: "schema",
    subtype: "schema",
    detectorId: "schema-integrity",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: [input.subjectId],
    semanticKey: canonicalJson({
      template: input.template,
      field: input.field,
      rule: input.rule
    })
  });
}

export function createDecisionFindingIdentity(input: DecisionIdentityInput): FindingIdentity {
  return createFindingIdentity({
    identityVersion: 1,
    family: "decision",
    subtype: input.issueKind,
    detectorId: "decision-integrity",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: [input.subjectId],
    semanticKey: canonicalJson({ decision: input.decisionId })
  });
}

export function createPolicyFindingIdentity(input: PolicyIdentityInput): FindingIdentity {
  return createFindingIdentity({
    identityVersion: 1,
    family: "policy",
    subtype: "policy-violation",
    detectorId: "policy-integrity",
    detectorVersion: DETECTOR_VERSION,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    subjectIds: [input.subjectId],
    semanticKey: canonicalJson({ rule: input.ruleId })
  });
}

export function createEntityAliasFindingIdentity(input: EntityAliasIdentityInput): FindingIdentity {
  return createFindingIdentity({
    identityVersion: 1,
    family: "entity-alias",
    subtype: "alias-pair",
    detectorId: "entity-alias",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: [...input.subjectIds].sort((left, right) => left.localeCompare(right)),
    semanticKey: canonicalJson({ kind: "unordered-pair" })
  });
}

export function createContradictionFindingIdentity(
  input: ContradictionIdentityInput
): FindingIdentity {
  const left = {
    subjectId: input.left.subjectId,
    locator: normalizeStructuralLocator(input.left.structuralLocator)
  };
  const right = {
    subjectId: input.right.subjectId,
    locator: normalizeStructuralLocator(input.right.structuralLocator)
  };
  return createFindingIdentity({
    identityVersion: 1,
    family: "contradiction",
    subtype: input.symmetric ? "symmetric" : "ordered",
    detectorId: "contradiction",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: uniqueSubjects([left.subjectId, right.subjectId]),
    semanticKey: input.symmetric
      ? canonicalJson({
          symmetric: true,
          operands: [left, right].sort(
            (a, b) => a.subjectId.localeCompare(b.subjectId) || a.locator.localeCompare(b.locator)
          )
        })
      : canonicalJson({ symmetric: false, left, right })
  });
}

export function createSemanticStalenessFindingIdentity(
  input: SemanticStalenessIdentityInput
): FindingIdentity {
  return createFindingIdentity({
    identityVersion: 1,
    family: "staleness",
    subtype: "staleness",
    detectorId: "semantic-staleness",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: [input.subjectId],
    semanticKey: canonicalJson({ rule: input.ruleId })
  });
}

export function createMaintenanceFindingIdentity(input: MaintenanceIdentityInput): FindingIdentity {
  return createFindingIdentity({
    identityVersion: 1,
    family: "staleness",
    subtype: input.subtype,
    detectorId: "change-aware-maintenance",
    detectorVersion: DETECTOR_VERSION,
    subjectIds: uniqueSubjects([input.sourceSubjectId, input.targetSubjectId]),
    semanticKey: canonicalJson({ dependency: input.dependencyKind ?? null })
  });
}

function uniqueSubjects(subjectIds: readonly string[]): string[] {
  return [...new Set(subjectIds)].sort((left, right) => left.localeCompare(right));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
