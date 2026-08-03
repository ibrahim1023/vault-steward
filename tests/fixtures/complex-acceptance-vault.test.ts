import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { checkReferenceIntegrity } from "../../src/reference/check.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";
import { checkTasks } from "../../src/tasks/check.js";

const fixtureRoot = resolve(import.meta.dirname, "../../fixtures/complex-acceptance-vault");

describe("complex acceptance vault", () => {
  it("keeps realistic deterministic review cases available", async () => {
    const files = await markdownFiles(fixtureRoot);
    const scan = scanVaultFiles(files);
    const references = checkReferenceIntegrity(scan);
    const controlRoom = files.find((file) => file.path === "Work/Launch Control Room.md");

    expect(files).toHaveLength(23);
    expect(references.filter((finding) => finding.type === "broken-reference")).toHaveLength(5);
    expect(references.filter((finding) => finding.type === "invalid-reference")).toHaveLength(1);
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "Tasks/Regional Follow-ups.md",
        "Work/Stakeholder Directory.md",
        "Work/Partner Enablement.md"
      ])
    );
    expect(controlRoom).toBeDefined();
    expect(
      checkTasks(controlRoom!.content, "2026-08-03T00:00:00.000Z").map((issue) => issue.kind)
    ).toEqual(
      expect.arrayContaining([
        "overdue",
        "orphaned",
        "completion-pending",
        "duplicated",
        "abandoned",
        "malformed"
      ])
    );
  });
});

async function markdownFiles(directory: string): Promise<Array<{ path: string; content: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(path);
      if (!entry.name.endsWith(".md")) return [];
      return [{ path: relative(fixtureRoot, path), content: await readFile(path, "utf8") }];
    })
  );
  return nested.flat();
}
