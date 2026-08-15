import { describe, expect, it } from "vitest";

import { scanVaultFiles } from "../../src/scanner/scan.js";
import { checkReferenceIntegrity } from "../../src/reference/check.js";

describe("reference integrity", () => {
  it("reports missing notes, attachments, anchors, and unsafe targets with evidence", () => {
    const scan = scanVaultFiles([
      {
        path: "Home.md",
        content: "[[Missing]]\n![[attachments/missing.pdf]]\n[[Target#Absent]]\n[[../outside]]"
      },
      { path: "Target.md", content: "# Present" },
      { path: "attachments/available.pdf", content: "binary" }
    ]);

    const findings = checkReferenceIntegrity(scan);

    expect(findings.map((finding) => finding.type)).toEqual([
      "broken-reference",
      "broken-reference",
      "broken-reference",
      "invalid-reference"
    ]);
    expect(findings.every((finding) => finding.evidence[0]?.notePath === "Home.md")).toBe(true);
  });

  it("accepts valid note, attachment, and anchor targets", () => {
    const scan = scanVaultFiles([
      { path: "Home.md", content: "[[Target#Present]]\n![[attachments/available.pdf]]" },
      { path: "Target.md", content: "# Present" },
      { path: "attachments/available.pdf", content: "binary" }
    ]);

    expect(checkReferenceIntegrity(scan)).toEqual([]);
  });

  it("resolves unique basenames and aliases but rejects ambiguous matches", () => {
    const valid = scanVaultFiles([
      { path: "Home.md", content: "[[Guide]]\n[[Legacy Guide]]" },
      {
        path: "Guides/Guide.md",
        content: "---\naliases: [Legacy Guide]\n---\n# Guide"
      }
    ]);
    expect(checkReferenceIntegrity(valid)).toEqual([]);

    const ambiguous = scanVaultFiles([
      { path: "Home.md", content: "[[Guide]]" },
      { path: "One/Guide.md", content: "# One" },
      { path: "Two/Guide.md", content: "# Two" }
    ]);
    expect(checkReferenceIntegrity(ambiguous)).toEqual([
      expect.objectContaining({ explanation: expect.stringContaining("ambiguous target") })
    ]);
  });

  it("validates heading and block anchors while ignoring block IDs inside code", () => {
    const scan = scanVaultFiles([
      {
        path: "Home.md",
        content: "[[Target#Present]]\n[[Target#^valid-block]]\n[[Target#^code-block]]"
      },
      {
        path: "Target.md",
        content:
          "# Present\n\nA referenceable paragraph. ^valid-block\n\n```\nnot a block ^code-block\n```"
      }
    ]);

    expect(scan.notes[1]?.blockIds).toEqual(["valid-block"]);
    expect(checkReferenceIntegrity(scan)).toEqual([
      expect.objectContaining({ explanation: expect.stringContaining("missing anchor") })
    ]);
  });

  it("ignores external web links because they are outside the vault graph", () => {
    const scan = scanVaultFiles([{ path: "Home.md", content: "[web](https://example.com)" }]);

    expect(checkReferenceIntegrity(scan)).toEqual([]);
  });

  it("resolves Markdown links relative to the source note", () => {
    const scan = scanVaultFiles([
      { path: "Notes/Home.md", content: "[Target](Target.md)\n[Parent](../Root.md)" },
      { path: "Notes/Target.md", content: "# Target" },
      { path: "Root.md", content: "# Root" }
    ]);

    expect(checkReferenceIntegrity(scan)).toEqual([]);
  });

  it("resolves percent-encoded internal Markdown paths", () => {
    const scan = scanVaultFiles([
      { path: "Work/Home.md", content: "[Guide](../Guides/New%20Guide.md#Plan)" },
      { path: "Guides/New Guide.md", content: "# Plan" }
    ]);

    expect(checkReferenceIntegrity(scan)).toEqual([]);
  });

  it("assigns a distinct immutable ID to each scan", () => {
    const files = [{ path: "Home.md", content: "# Home" }];

    expect(scanVaultFiles(files).id).not.toBe(scanVaultFiles(files).id);
  });

  it("reuses a parsed note only when its normalized path and revision are unchanged", () => {
    const cached = scanVaultFiles([
      { path: "Notes\\Home.md", content: "# Cached", revision: "r1" }
    ]);
    const reusable = new Map(cached.notes.map((note) => [note.path, note]));

    const reused = scanVaultFiles(
      [{ path: "Notes/Home.md", content: "# Different source is ignored", revision: "r1" }],
      reusable
    );
    const reparsed = scanVaultFiles(
      [{ path: "Notes/Home.md", content: "# Changed", revision: "r2" }],
      reusable
    );

    expect(reused.notes[0]).toBe(cached.notes[0]);
    expect(reparsed.notes[0]).not.toBe(cached.notes[0]);
    expect(reparsed.notes[0]?.content).toBe("# Changed");
  });
});
