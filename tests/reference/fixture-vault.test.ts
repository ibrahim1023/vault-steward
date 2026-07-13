import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { checkReferenceIntegrity } from "../../src/reference/check.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

const fixtureRoot = resolve(import.meta.dirname, "../fixtures/vaults/references");

describe("reference fixture vault", () => {
  it("reports the expected local integrity issues from fixture files", async () => {
    const scan = scanVaultFiles([
      { path: "Home.md", content: await readFile(resolve(fixtureRoot, "Home.md"), "utf8") },
      { path: "Target.md", content: await readFile(resolve(fixtureRoot, "Target.md"), "utf8") },
      {
        path: "attachments/available.pdf",
        content: await readFile(resolve(fixtureRoot, "attachments/available.pdf"), "utf8")
      }
    ]);

    expect(checkReferenceIntegrity(scan).map((finding) => finding.type)).toEqual([
      "broken-reference",
      "broken-reference",
      "broken-reference",
      "invalid-reference"
    ]);
  });
});
