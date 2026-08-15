import { describe, expect, it } from "vitest";

import { buildChangeAwareFindings } from "../../src/maintenance/change-aware.js";
import type { ScannedNote } from "../../src/scanner/scan.js";

const note = (path: string, frontmatter: Record<string, unknown> = {}): ScannedNote => ({
  path,
  content: "",
  frontmatter,
  revision: path,
  headings: [],
  blockIds: [],
  references: []
});

describe("change-aware maintenance", () => {
  it("explains a citation to a newly superseded decision with exact source evidence", () => {
    const previous = note("Decisions/ADR-1.md", { kind: "decision" });
    const plan = {
      ...note("Plans/Launch.md"),
      references: [
        {
          kind: "wiki" as const,
          rawTarget: "Decisions/ADR-1",
          locator: "line:4",
          excerpt: "[[Decisions/ADR-1]]"
        }
      ]
    };
    const result = buildChangeAwareFindings({
      scanId: "scan",
      events: [{ schemaVersion: 1, kind: "modify", path: "Decisions/ADR-1.md" }],
      previousNotes: [previous, plan],
      snapshot: {
        id: "scan",
        notes: [{ ...previous, frontmatter: { kind: "decision", status: "superseded" } }, plan]
      }
    });
    expect(result).toEqual([
      expect.objectContaining({
        type: "staleness",
        explanation: "This note cites a superseded decision and should be reviewed.",
        evidence: [expect.objectContaining({ notePath: "Plans/Launch.md", locator: "line:4" })]
      })
    ]);
  });

  it("keeps rename and deletion review-only while explaining affected references", () => {
    const source = {
      ...note("Plans/Launch.md"),
      references: [
        {
          kind: "wiki" as const,
          rawTarget: "Decisions/ADR-1",
          locator: "line:3",
          excerpt: "[[Decisions/ADR-1]]"
        }
      ]
    };
    const result = buildChangeAwareFindings({
      scanId: "scan",
      events: [{ schemaVersion: 1, kind: "delete", path: "Decisions/ADR-1.md" }],
      previousNotes: [source, note("Decisions/ADR-1.md")],
      snapshot: { id: "scan", notes: [source] }
    });
    expect(result[0]).toMatchObject({
      type: "staleness",
      status: "open",
      explanation: "This note cites a deleted note and should be reviewed for context.",
      suggestedFixes: []
    });
  });
});
