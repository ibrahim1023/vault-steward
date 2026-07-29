import { describe, expect, it } from "vitest";
import {
  validateFindingLineage,
  validateTraceExport,
  validateTraceMetadata,
  validateTracePreferences
} from "../../src/contracts/trace.js";

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
  it("requires bounded local-only trace preferences", () => {
    expect(
      validateTracePreferences({
        retentionDays: 30,
        storePromptSnapshots: false,
        storeModelOutputSnapshots: false,
        redactExcerpts: true,
        excludedFolders: ["Private"]
      })
    ).toBe(true);
    expect(
      validateTracePreferences({
        retentionDays: 30,
        storePromptSnapshots: true,
        storeModelOutputSnapshots: false,
        redactExcerpts: false,
        excludedFolders: []
      })
    ).toBe(false);
    expect(
      validateTracePreferences({
        retentionDays: 30,
        storePromptSnapshots: false,
        storeModelOutputSnapshots: false,
        redactExcerpts: true,
        excludedFolders: ["../escape"]
      })
    ).toBe(false);
  });
  it("accepts only content-free, known-kind trace exports", () => {
    expect(
      validateTraceExport({
        schemaVersion: 1,
        scanId: "scan-1",
        exportedAt: "2026-07-29T00:00:00.000Z",
        timeline: [
          {
            id: "root",
            parentSpanId: null,
            kind: "governed-scan",
            startedAt: "2026-07-29T00:00:00.000Z",
            completedAt: null,
            outcome: "success",
            durationMs: null,
            retryCount: 0,
            fileCount: null,
            errorCode: null,
            attributes: { fileCount: 2 }
          }
        ],
        configuration: null
      })
    ).toBe(true);
    expect(
      validateTraceExport({
        schemaVersion: 1,
        scanId: "scan-1",
        exportedAt: "now",
        timeline: [],
        configuration: { fingerprint: "x", values: { unsafe: "note body\ntext" } }
      })
    ).toBe(false);
  });
});
