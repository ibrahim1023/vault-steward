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

  it("assigns a distinct immutable ID to each scan", () => {
    const files = [{ path: "Home.md", content: "# Home" }];

    expect(scanVaultFiles(files).id).not.toBe(scanVaultFiles(files).id);
  });
});
