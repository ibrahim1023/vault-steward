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
});
