import { describe, expect, it } from "vitest";

import { parseReferenceRepairIntent } from "../../src/contracts/reference-repair.js";

describe("reference repair intent contract", () => {
  it("accepts a bounded heading-anchor intent", () => {
    expect(
      parseReferenceRepairIntent({
        schemaVersion: 1,
        kind: "replace-heading-anchor",
        scanId: "scan-1",
        findingId: "finding-1",
        targetPath: "Guides/Target.md",
        provenance: "ai-suggested",
        anchor: { kind: "heading", value: "Launch Plan", candidateId: "heading:launch-plan" }
      })
    ).toMatchObject({ ok: true });
  });

  it("rejects traversal, unknown fields, and mismatched anchor kinds", () => {
    expect(
      parseReferenceRepairIntent({
        schemaVersion: 1,
        kind: "replace-block-anchor",
        scanId: "scan-1",
        findingId: "finding-1",
        targetPath: "../Target.md",
        provenance: "ai-suggested",
        anchor: { kind: "heading", value: "Plan", candidateId: "heading:plan" },
        patch: "untrusted"
      })
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.stringContaining("unknown field"),
        expect.stringContaining("safe vault Markdown path"),
        expect.stringContaining("must agree")
      ])
    });
  });

  it("rejects anchor data on a retarget intent", () => {
    expect(
      parseReferenceRepairIntent({
        schemaVersion: 1,
        kind: "retarget-note",
        scanId: "scan-1",
        findingId: "finding-1",
        targetPath: "Target.md",
        provenance: "verified-rename",
        anchor: { kind: "heading", value: "Plan", candidateId: "heading:plan" }
      })
    ).toMatchObject({ ok: false });
  });
});
