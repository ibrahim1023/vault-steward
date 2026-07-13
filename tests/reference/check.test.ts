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
});
