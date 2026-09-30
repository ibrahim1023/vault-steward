import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createEvidenceRevisionKey,
  createFindingIdentity,
  createFindingOccurrence,
  parseFindingIdentity,
  parseFindingOccurrence,
  type EvidenceRevisionSubject,
  type FindingIdentityInput
} from "../../src/contracts/finding-identity.js";
import type { Finding, FindingV1, FindingV2 } from "../../src/contracts/index.js";

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

const baseInput: FindingIdentityInput = {
  identityVersion: 1,
  family: "task",
  subtype: "overdue",
  detectorId: "task-checker",
  detectorVersion: "1.0.0",
  policyId: "policy-tasking",
  policyVersion: "2",
  subjectIds: ["subject-b", "subject-a"],
  semanticKey: "overdue-task:note-1:line-4"
};

const evidenceSubjects: [EvidenceRevisionSubject, EvidenceRevisionSubject] = [
  {
    role: "target",
    subjectId: "subject-b",
    locator: "note:body",
    sourceRevision: "rev-2"
  },
  {
    role: "source",
    subjectId: "subject-a",
    locator: "note:frontmatter:status",
    sourceRevision: "rev-1"
  }
];

describe("finding identity contracts", () => {
  it("produces identical stable keys regardless of subject ID order", () => {
    const first = createFindingIdentity(baseInput);
    const second = createFindingIdentity({
      ...baseInput,
      subjectIds: [...baseInput.subjectIds].reverse()
    });

    expect(first.stableKey).toBe(second.stableKey);
    expect(first.stableKey.startsWith("finding:v1:")).toBe(true);
    expect(first.schemaVersion).toBe(1);
  });

  it("changes the stable key when detector, policy, or semantic parts change", () => {
    const baseline = createFindingIdentity(baseInput).stableKey;

    for (const mutation of [
      { detectorId: "task-checker-2" },
      { detectorVersion: "1.0.1" },
      { policyId: "policy-other" },
      { policyVersion: "3" },
      { semanticKey: "overdue-task:note-1:line-5" },
      { subtype: "abandoned" },
      { family: "schema" as const },
      { subjectIds: ["subject-a"] }
    ]) {
      expect(createFindingIdentity({ ...baseInput, ...mutation }).stableKey).not.toBe(baseline);
    }
  });

  it("derives the documented SHA-256 canonical stable key", () => {
    const identity = createFindingIdentity(baseInput);
    const expectedPayload = JSON.stringify([
      1,
      "task",
      "overdue",
      "task-checker",
      "1.0.0",
      "policy-tasking",
      "2",
      ["subject-a", "subject-b"],
      "overdue-task:note-1:line-4"
    ]);

    expect(identity.stableKey).toBe(`finding:v1:${sha256Hex(expectedPayload)}`);
  });

  it("omits policy fields as null in the canonical payload", () => {
    const withoutPolicy = { ...baseInput };
    delete withoutPolicy.policyId;
    delete withoutPolicy.policyVersion;
    const identity = createFindingIdentity(withoutPolicy);
    const expectedPayload = JSON.stringify([
      1,
      "task",
      "overdue",
      "task-checker",
      "1.0.0",
      null,
      null,
      ["subject-a", "subject-b"],
      "overdue-task:note-1:line-4"
    ]);

    expect(identity.stableKey).toBe(`finding:v1:${sha256Hex(expectedPayload)}`);
  });

  it("parses a valid identity and rejects tampering by recompute", () => {
    const identity = createFindingIdentity(baseInput);
    expect(parseFindingIdentity(identity)).toEqual({ ok: true, value: identity });

    expect(
      parseFindingIdentity({ ...identity, stableKey: "finding:v1:0".repeat(1) })
    ).toMatchObject({
      ok: false
    });
    expect(parseFindingIdentity({ ...identity, subtype: "abandoned" })).toMatchObject({
      ok: false
    });
    expect(parseFindingIdentity({ ...identity, semanticKey: "changed" })).toMatchObject({
      ok: false
    });
  });

  it("rejects out-of-bounds and forbidden identity input", () => {
    const forbidden = [
      "/absolute/path",
      "C:\\vault\\note.md",
      "folder/../note",
      "https://example.com/x",
      "http://example.com",
      "contains secret here",
      "api-key=abc123",
      "authorization header",
      "bearer token",
      "prompt injection",
      "line\nbreak",
      "bad\u0000control"
    ];
    for (const bad of forbidden) {
      expect(() => createFindingIdentity({ ...baseInput, semanticKey: bad })).toThrowError(Error);
      expect(() =>
        createFindingIdentity({ ...baseInput, subjectIds: ["subject-a", bad] })
      ).toThrowError(Error);
      expect(() => createFindingIdentity({ ...baseInput, detectorId: bad })).toThrowError(Error);
    }

    expect(() => createFindingIdentity({ ...baseInput, semanticKey: "" })).toThrowError(Error);
    expect(() =>
      createFindingIdentity({ ...baseInput, semanticKey: "x".repeat(513) })
    ).toThrowError(Error);
    expect(() => createFindingIdentity({ ...baseInput, subtype: "x".repeat(129) })).toThrowError(
      Error
    );
    expect(() => createFindingIdentity({ ...baseInput, subjectIds: [] })).toThrowError(Error);
    expect(() =>
      createFindingIdentity({ ...baseInput, subjectIds: ["subject-a", "subject-a"] })
    ).toThrowError(Error);
    expect(() =>
      createFindingIdentity({
        ...baseInput,
        subjectIds: Array.from({ length: 17 }, (_, index) => `subject-${index}`)
      })
    ).toThrowError(Error);
    expect(() => createFindingIdentity({ ...baseInput, family: "unknown" as never })).toThrowError(
      Error
    );
    expect(() => createFindingIdentity({ ...baseInput, identityVersion: 0 as never })).toThrowError(
      Error
    );
  });

  it("allows locators and subject IDs with safe punctuation", () => {
    const identity = createFindingIdentity({
      ...baseInput,
      subjectIds: ["model/openai-gpt", "subject-a"],
      semanticKey: "field:status=value"
    });
    expect(identity.stableKey.startsWith("finding:v1:")).toBe(true);
  });
});

describe("evidence revision keys", () => {
  it("is order-independent across subjects", () => {
    const first = createEvidenceRevisionKey(evidenceSubjects);
    const second = createEvidenceRevisionKey([...evidenceSubjects].reverse());

    expect(first).toBe(second);
    expect(first.startsWith("evidence:v1:")).toBe(true);
  });

  it("derives the documented SHA-256 canonical evidence key", () => {
    const key = createEvidenceRevisionKey(evidenceSubjects);
    const normalized = [...evidenceSubjects]
      .map((subject) => ({
        role: subject.role,
        subjectId: subject.subjectId,
        locator: subject.locator,
        sourceRevision: subject.sourceRevision
      }))
      .sort(
        (a, b) =>
          a.role.localeCompare(b.role) ||
          a.subjectId.localeCompare(b.subjectId) ||
          a.locator.localeCompare(b.locator) ||
          a.sourceRevision.localeCompare(b.sourceRevision)
      );

    expect(key).toBe(`evidence:v1:${sha256Hex(JSON.stringify(normalized))}`);
  });

  it("changes when role, locator, or revision changes", () => {
    const baseline = createEvidenceRevisionKey(evidenceSubjects);

    for (const mutation of [
      { role: "other" },
      { locator: "note:body:other" },
      { sourceRevision: "rev-3" },
      { subjectId: "subject-c" }
    ]) {
      const mutated = evidenceSubjects.map((subject, index) =>
        index === 0 ? { ...subject, ...mutation } : subject
      );
      expect(createEvidenceRevisionKey(mutated)).not.toBe(baseline);
    }
  });

  it("rejects exact duplicate subjects and unsafe input", () => {
    expect(() =>
      createEvidenceRevisionKey([evidenceSubjects[0], { ...evidenceSubjects[0] }])
    ).toThrowError(Error);
    expect(() => createEvidenceRevisionKey([])).toThrowError(Error);
    expect(() =>
      createEvidenceRevisionKey([
        ...evidenceSubjects,
        ...Array.from({ length: 16 }, (_, index) => ({
          role: `role-${index}`,
          subjectId: `extra-${index}`,
          locator: `locator-${index}`,
          sourceRevision: `rev-${index}`
        }))
      ])
    ).toThrowError(Error);
    expect(() =>
      createEvidenceRevisionKey([
        { role: "source", subjectId: "s", locator: "a/../b", sourceRevision: "r" }
      ])
    ).toThrowError(Error);
  });
});

describe("finding occurrences", () => {
  const occurrenceInput = () => ({
    stableKey: createFindingIdentity(baseInput).stableKey,
    scanId: "scan-1",
    evidenceRevisionKey: createEvidenceRevisionKey(evidenceSubjects),
    findingId: "finding-row-1"
  });

  it("derives the documented SHA-256 occurrence ID", () => {
    const input = occurrenceInput();
    const occurrence = createFindingOccurrence(input);

    const expectedPayload = JSON.stringify([
      input.stableKey,
      input.scanId,
      input.evidenceRevisionKey
    ]);
    expect(occurrence.occurrenceId).toBe(`occurrence:v1:${sha256Hex(expectedPayload)}`);
    expect(occurrence.schemaVersion).toBe(1);
  });

  it("differs by scan or evidence revision", () => {
    const input = occurrenceInput();
    const baseline = createFindingOccurrence(input).occurrenceId;

    expect(createFindingOccurrence({ ...input, scanId: "scan-2" }).occurrenceId).not.toBe(baseline);
    expect(
      createFindingOccurrence({
        ...input,
        evidenceRevisionKey: createEvidenceRevisionKey([
          { ...evidenceSubjects[0], sourceRevision: "rev-9" },
          evidenceSubjects[1]
        ])
      }).occurrenceId
    ).not.toBe(baseline);
  });

  it("round-trips through the parser and rejects tampering", () => {
    const occurrence = createFindingOccurrence(occurrenceInput());
    expect(parseFindingOccurrence(occurrence)).toEqual({ ok: true, value: occurrence });

    for (const tampered of [
      { ...occurrence, occurrenceId: "occurrence:v1:deadbeef" },
      { ...occurrence, scanId: "scan-2" },
      { ...occurrence, stableKey: "finding:v1:not-matching" },
      { ...occurrence, stableKey: "plain-key" },
      { ...occurrence, evidenceRevisionKey: "plain-key" }
    ]) {
      expect(parseFindingOccurrence(tampered)).toMatchObject({ ok: false });
    }
  });

  it("rejects malformed hashes behind the v1 prefixes", () => {
    const input = occurrenceInput();
    expect(() =>
      createFindingOccurrence({ ...input, stableKey: "finding:v1:not-a-hash" })
    ).toThrowError(Error);
    expect(() =>
      createFindingOccurrence({
        ...input,
        evidenceRevisionKey: "evidence:v1:not-a-hash"
      })
    ).toThrowError(Error);

    const occurrence = createFindingOccurrence(input);
    expect(
      parseFindingOccurrence({ ...occurrence, occurrenceId: "occurrence:v1:not-a-hash" })
    ).toMatchObject({ ok: false });
    expect(
      parseFindingOccurrence({
        ...occurrence,
        occurrenceId: `occurrence:v1:${"f".repeat(63)}`
      })
    ).toMatchObject({ ok: false });
  });

  it("rejects malformed occurrence input without throwing", () => {
    for (const malformed of [null, undefined, 42, "occurrence", [], {}, { schemaVersion: 2 }]) {
      expect(parseFindingOccurrence(malformed)).toMatchObject({ ok: false });
      expect(parseFindingIdentity(malformed)).toMatchObject({ ok: false });
    }
  });
});

describe("finding schema compatibility", () => {
  it("accepts v1 and v2 findings through the shared Finding type", () => {
    const v1: FindingV1 = {
      schemaVersion: 1,
      id: "finding-1",
      scanId: "scan-1",
      type: "task",
      severity: "low",
      evidence: [],
      affectedNoteIds: [],
      explanation: "Overdue task.",
      suggestedFixes: [],
      confidence: 0.9,
      status: "open"
    };
    const identity = createFindingIdentity(baseInput);
    const evidenceRevisionKey = createEvidenceRevisionKey(evidenceSubjects);
    const occurrence = createFindingOccurrence({
      stableKey: identity.stableKey,
      scanId: "scan-1",
      evidenceRevisionKey,
      findingId: "finding-1"
    });
    const v2: FindingV2 = {
      ...v1,
      schemaVersion: 2,
      identity,
      stableKey: identity.stableKey,
      occurrenceId: occurrence.occurrenceId,
      evidenceRevisionKey
    };
    const findings: Finding[] = [v1, v2];

    expect(findings.map((finding) => finding.id)).toEqual(["finding-1", "finding-1"]);
    expect(v2.stableKey.startsWith("finding:v1:")).toBe(true);
  });
});
