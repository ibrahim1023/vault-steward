import { describe, expect, it } from "vitest";

import { hydrateFinding, type FindingRecord } from "../../src/storage/repositories.js";

const validRecord: FindingRecord = {
  id: "finding-1",
  scanId: "scan-1",
  type: "broken-reference",
  severity: "medium",
  status: "open",
  evidenceJson: JSON.stringify([
    { notePath: "Notes/Plan.md", locator: "line:4", excerpt: "[[Missing note]]" }
  ]),
  payloadJson: JSON.stringify({ confidence: 0.8, explanation: "The target is missing." })
};

describe("finding hydration", () => {
  it("hydrates a persisted finding with contract values", () => {
    expect(hydrateFinding(validRecord)).toMatchObject({
      id: "finding-1",
      type: "broken-reference",
      severity: "medium",
      status: "open",
      confidence: 0.8
    });
  });

  it.each([
    ["an unknown finding type", { type: "invented" }],
    ["an unknown severity", { severity: "urgent" }],
    ["an unknown status", { status: "queued" }],
    ["a non-finite confidence", { payloadJson: '{"confidence":1e999,"explanation":"unsafe"}' }]
  ])("rejects a persisted finding with %s", (_label, override) => {
    expect(hydrateFinding({ ...validRecord, ...override })).toBeNull();
  });

  it("hydrates a persisted v2 payload as v2 while a legacy payload stays v1", () => {
    expect(hydrateFinding(validRecord)?.schemaVersion).toBe(1);

    const identity = {
      schemaVersion: 1,
      identityVersion: 1,
      stableKey: `finding:v1:${"0".repeat(64)}`,
      family: "broken-reference",
      subtype: "missing",
      detectorId: "reference-integrity",
      detectorVersion: "1",
      subjectIds: ["subject-a"],
      semanticKey: "{}"
    };
    expect(
      hydrateFinding({
        ...validRecord,
        payloadJson: JSON.stringify({
          confidence: 0.8,
          explanation: "x",
          identity,
          stableKey: identity.stableKey,
          occurrenceId: "occurrence:v1:not-canonical",
          evidenceRevisionKey: `evidence:v1:${"1".repeat(64)}`
        })
      })
    ).toBeNull();
  });
});
