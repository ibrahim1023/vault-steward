import { describe, expect, it } from "vitest";
import { analyzeChangeImpact } from "../../src/indexing/impact.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

describe("change impact analysis", () => {
  it("finds inbound references and proposes only unambiguous wiki-link rename repairs", () => {
    const snapshot = scanVaultFiles([
      { path: "Home.md", content: "[[Target]]\n[Target](Target.md)" },
      { path: "Target.md", content: "Target" }
    ]);
    const impact = analyzeChangeImpact(
      { kind: "rename", oldPath: "Target.md", path: "Renamed.md" },
      snapshot
    );
    expect(impact.affectedPaths).toEqual(["Home.md"]);
    expect(impact.safeRenameTargets).toEqual([
      { sourcePath: "Home.md", replacement: "[[Renamed]]" }
    ]);
  });

  it("reports deletion impact without offering a repair", () => {
    const snapshot = scanVaultFiles([
      { path: "Home.md", content: "![[Target]]" },
      { path: "Target.md", content: "Target" }
    ]);
    expect(
      analyzeChangeImpact({ kind: "delete", path: "Target.md" }, snapshot).safeRenameTargets
    ).toEqual([]);
  });
});
