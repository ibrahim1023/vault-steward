import { describe, expect, it } from "vitest";

import { parseEntityCanonicalIntent } from "../../src/contracts/entity-canonical.js";

describe("entity canonical intent", () => {
  it("accepts a bounded snapshot candidate without patch or write authority", () => {
    expect(
      parseEntityCanonicalIntent({
        schemaVersion: 1,
        kind: "select-canonical",
        scanId: "scan-1",
        findingId: "finding-1",
        candidateId: "entity-a"
      })
    ).toEqual({
      ok: true,
      value: {
        schemaVersion: 1,
        kind: "select-canonical",
        scanId: "scan-1",
        findingId: "finding-1",
        candidateId: "entity-a"
      }
    });
  });

  it("rejects unknown fields and any attempted patch authority", () => {
    expect(
      parseEntityCanonicalIntent({
        schemaVersion: 1,
        kind: "select-canonical",
        scanId: "scan-1",
        findingId: "finding-1",
        candidateId: "entity-a",
        operations: [{ kind: "replace-range" }]
      }).ok
    ).toBe(false);
  });
});
