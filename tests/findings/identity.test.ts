import { describe, expect, it } from "vitest";

import type { FindingIdentity } from "../../src/contracts/index.js";
import {
  createContradictionFindingIdentity,
  createDecisionFindingIdentity,
  createEntityAliasFindingIdentity,
  createMaintenanceFindingIdentity,
  createPolicyFindingIdentity,
  createReferenceFindingIdentity,
  createSchemaFindingIdentity,
  createSemanticStalenessFindingIdentity,
  createTaskFindingIdentity,
  FINDING_IDENTITY_PROFILE_HASH,
  normalizeStructuralLocator
} from "../../src/findings/identity.js";

const expectV1Identity = (identity: FindingIdentity) => {
  expect(identity.schemaVersion).toBe(1);
  expect(identity.identityVersion).toBe(1);
  expect(identity.stableKey).toMatch(/^finding:v1:[0-9a-f]{64}$/);
};

describe("finding identity adapters", () => {
  it("derives a reference identity with the normalized target", () => {
    const identity = createReferenceFindingIdentity({
      family: "broken-reference",
      subtype: "missing",
      sourceSubjectId: "subject-source",
      normalizedTarget: "Guides/Missing.md"
    });

    expectV1Identity(identity);
    expect(identity.family).toBe("broken-reference");
    expect(identity.detectorId).toBe("reference-integrity");
    expect(identity.detectorVersion).toBe("1");
    expect(identity.subjectIds).toEqual(["subject-source"]);
    expect(JSON.parse(identity.semanticKey)).toEqual({ target: "Guides/Missing.md" });
  });

  it("uses the reference-normalization detector for the normalization family", () => {
    const identity = createReferenceFindingIdentity({
      family: "reference-normalization",
      subtype: "verified-rename",
      sourceSubjectId: "subject-source",
      targetSubjectId: "subject-target",
      normalizedTarget: "Guides/New.md"
    });

    expect(identity.detectorId).toBe("reference-normalization");
    expect(identity.subjectIds).toEqual(["subject-source", "subject-target"]);
  });

  it("derives a task identity from issue kind and explicit task id", () => {
    const identity = createTaskFindingIdentity({
      subjectId: "subject-1",
      issueKind: "overdue",
      taskId: "launch",
      structuralLocator: "line:4:column:1"
    });

    expectV1Identity(identity);
    expect(identity.family).toBe("task");
    expect(identity.detectorId).toBe("task-integrity");
    expect(identity.subtype).toBe("overdue");
    expect(JSON.parse(identity.semanticKey)).toEqual({ kind: "overdue", ref: "launch" });
  });

  it("derives a schema identity from template, field, and rule", () => {
    const identity = createSchemaFindingIdentity({
      subjectId: "subject-1",
      template: "project",
      field: "owner",
      rule: "required"
    });

    expectV1Identity(identity);
    expect(identity.family).toBe("schema");
    expect(identity.detectorId).toBe("schema-integrity");
    expect(JSON.parse(identity.semanticKey)).toEqual({
      template: "project",
      field: "owner",
      rule: "required"
    });
  });

  it("derives a decision identity from issue kind and decision id", () => {
    const identity = createDecisionFindingIdentity({
      subjectId: "subject-1",
      issueKind: "missing-rationale",
      decisionId: "Decisions/ADR-1.md"
    });

    expectV1Identity(identity);
    expect(identity.family).toBe("decision");
    expect(identity.detectorId).toBe("decision-integrity");
    expect(identity.subtype).toBe("missing-rationale");
    expect(JSON.parse(identity.semanticKey)).toEqual({ decision: "Decisions/ADR-1.md" });
  });

  it("derives a policy identity carrying policy id and version", () => {
    const identity = createPolicyFindingIdentity({
      subjectId: "subject-1",
      policyId: "project-owner",
      policyVersion: "1",
      ruleId: "owner-required"
    });

    expectV1Identity(identity);
    expect(identity.family).toBe("policy");
    expect(identity.detectorId).toBe("policy-integrity");
    expect(identity.policyId).toBe("project-owner");
    expect(identity.policyVersion).toBe("1");
    expect(JSON.parse(identity.semanticKey)).toEqual({ rule: "owner-required" });
  });

  it("derives an entity-alias identity independent of input order", () => {
    const forward = createEntityAliasFindingIdentity({ subjectIds: ["subject-a", "subject-b"] });
    const reversed = createEntityAliasFindingIdentity({ subjectIds: ["subject-b", "subject-a"] });

    expectV1Identity(forward);
    expect(forward.family).toBe("entity-alias");
    expect(forward.detectorId).toBe("entity-alias");
    expect(forward.subjectIds).toEqual(["subject-a", "subject-b"]);
    expect(forward.stableKey).toBe(reversed.stableKey);
  });

  it("rejects an entity-alias pair with equal members", () => {
    expect(() =>
      createEntityAliasFindingIdentity({ subjectIds: ["subject-a", "subject-a"] })
    ).toThrow();
  });

  it("derives a symmetric contradiction identity independent of operand order", () => {
    const left = { subjectId: "subject-a", structuralLocator: "line:1:column:1" };
    const right = { subjectId: "subject-b", structuralLocator: "line:2:column:1" };
    const forward = createContradictionFindingIdentity({ left, right, symmetric: true });
    const reversed = createContradictionFindingIdentity({
      left: right,
      right: left,
      symmetric: true
    });

    expectV1Identity(forward);
    expect(forward.family).toBe("contradiction");
    expect(forward.detectorId).toBe("contradiction");
    expect(forward.stableKey).toBe(reversed.stableKey);
  });

  it("preserves left and right roles for ordered contradictions", () => {
    const left = { subjectId: "subject-a", structuralLocator: "line:1:column:1" };
    const right = { subjectId: "subject-b", structuralLocator: "line:2:column:1" };
    const forward = createContradictionFindingIdentity({ left, right, symmetric: false });
    const reversed = createContradictionFindingIdentity({
      left: right,
      right: left,
      symmetric: false
    });

    expect(forward.stableKey).not.toBe(reversed.stableKey);
  });

  it("derives a semantic staleness identity from subject and rule", () => {
    const identity = createSemanticStalenessFindingIdentity({
      subjectId: "subject-1",
      ruleId: "inactive-90-days"
    });

    expectV1Identity(identity);
    expect(identity.family).toBe("staleness");
    expect(identity.detectorId).toBe("semantic-staleness");
    expect(JSON.parse(identity.semanticKey)).toEqual({ rule: "inactive-90-days" });
  });

  it("derives a maintenance identity from subtype and both subjects", () => {
    const identity = createMaintenanceFindingIdentity({
      subtype: "rename",
      sourceSubjectId: "subject-citing",
      targetSubjectId: "subject-target",
      dependencyKind: "reference"
    });

    expectV1Identity(identity);
    expect(identity.family).toBe("staleness");
    expect(identity.detectorId).toBe("change-aware-maintenance");
    expect(identity.subtype).toBe("rename");
    expect(identity.subjectIds).toEqual(["subject-citing", "subject-target"]);
    expect(JSON.parse(identity.semanticKey)).toEqual({ dependency: "reference" });
  });

  it("keeps an explicit task id stable across locator moves and uses the locator fallback otherwise", () => {
    const explicitA = createTaskFindingIdentity({
      subjectId: "subject-1",
      issueKind: "orphaned",
      taskId: "launch",
      structuralLocator: "line:4:column:1"
    });
    const explicitB = createTaskFindingIdentity({
      subjectId: "subject-1",
      issueKind: "orphaned",
      taskId: "launch",
      structuralLocator: "line:9:column:1"
    });
    const fallbackA = createTaskFindingIdentity({
      subjectId: "subject-1",
      issueKind: "malformed",
      taskId: "line-4",
      structuralLocator: "line:4:column:1"
    });
    const fallbackB = createTaskFindingIdentity({
      subjectId: "subject-1",
      issueKind: "malformed",
      taskId: "line-4",
      structuralLocator: "line:9:column:1"
    });

    expect(explicitA.stableKey).toBe(explicitB.stableKey);
    expect(fallbackA.stableKey).not.toBe(fallbackB.stableKey);
    expect(JSON.parse(fallbackA.semanticKey)).toEqual({
      kind: "malformed",
      ref: "locator:v1:line:4:column:1"
    });
  });

  it("normalizes structural locator whitespace deterministically", () => {
    expect(normalizeStructuralLocator("  line:4:column:1 \n")).toBe("line:4:column:1");
    expect(normalizeStructuralLocator("heading:  Some   Heading")).toBe("heading: Some Heading");
  });

  it("exposes a 64-character lowercase hex identity profile hash", () => {
    expect(FINDING_IDENTITY_PROFILE_HASH).toMatch(/^[0-9a-f]{64}$/);
  });
});
