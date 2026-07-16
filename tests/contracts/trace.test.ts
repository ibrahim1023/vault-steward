import { describe, expect, it } from "vitest";
import { validateFindingLineage, validateTraceMetadata } from "../../src/contracts/trace.js";

describe("trace contracts", () => {
  it("accepts bounded metadata and rejects content-like values", () => {
    expect(validateTraceMetadata({ durationMs: 4, outcome: "success" })).toBe(true);
    expect(validateTraceMetadata("note body\nwith content")).toBe(false);
    expect(validateTraceMetadata("/Users/person/Vault/Note.md")).toBe(false);
  });
  it("requires complete finding lineage", () => {
    expect(
      validateFindingLineage({
        schemaVersion: 1,
        findingId: "f",
        scanId: "s",
        evidenceLocators: ["line:1"],
        parsedArtifactIds: ["p"],
        validatorId: "v",
        coordinatorDecisionId: "c",
        correlationId: "trace-1"
      })
    ).toBe(true);
    expect(
      validateFindingLineage({
        schemaVersion: 1,
        findingId: "f",
        scanId: "s",
        evidenceLocators: [],
        parsedArtifactIds: ["p"],
        validatorId: "v",
        coordinatorDecisionId: "c",
        correlationId: "trace-1"
      })
    ).toBe(false);
  });
});
