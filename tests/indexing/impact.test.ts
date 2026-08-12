import { describe, expect, it } from "vitest";
import { analyzeChangeImpact } from "../../src/indexing/impact.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

describe("change impact analysis", () => {
  it("records revision-bound wiki and Markdown rename repairs", () => {
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
      {
        sourcePath: "Home.md",
        sourceRevision: "memory-0",
        locator: "line:1:column:1",
        currentReference: "[[Target]]",
        replacement: "[[Renamed]]"
      },
      {
        sourcePath: "Home.md",
        sourceRevision: "memory-0",
        locator: "line:2:column:1",
        currentReference: "[Target](Target.md)",
        replacement: "[Target](Renamed.md)"
      }
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

  it("includes frontmatter dependents and preserves wiki aliases and anchors in a safe rename", () => {
    const snapshot = scanVaultFiles([
      { path: "Task.md", content: "---\nproject: Target\n---\n[[Target#Plan|the plan]]" },
      { path: "Decision.md", content: "---\nsupersedes: Target\n---\n" },
      { path: "Policy.md", content: "---\nappliesTo: Target\n---\n" },
      { path: "Alias.md", content: "---\naliases: [Target]\n---\n" },
      { path: "Target.md", content: "---\naliases: [Legacy]\n---\nTarget" }
    ]);
    const impact = analyzeChangeImpact(
      { kind: "rename", oldPath: "Target.md", path: "Renamed.md" },
      snapshot
    );

    expect(impact).toMatchObject({
      taskDependents: ["Task.md"],
      decisionDependents: ["Decision.md"],
      policyDependents: ["Policy.md"],
      aliasDependents: ["Alias.md"],
      safeRenameTargets: [
        {
          sourcePath: "Task.md",
          sourceRevision: "memory-0",
          locator: "line:1:column:1",
          currentReference: "[[Target#Plan|the plan]]",
          replacement: "[[Renamed#Plan|the plan]]"
        }
      ]
    });
  });

  it("preserves embed and Markdown link syntax when recording safe rename targets", () => {
    const snapshot = scanVaultFiles([
      {
        path: "Work/Home.md",
        content: "![[Target#Plan|preview]]\n![Diagram](../Target.md#plan)"
      },
      { path: "Target.md", content: "Target" }
    ]);

    expect(
      analyzeChangeImpact(
        { kind: "rename", oldPath: "Target.md", path: "Guides/Renamed Guide.md" },
        snapshot
      ).safeRenameTargets
    ).toEqual([
      {
        sourcePath: "Work/Home.md",
        sourceRevision: "memory-0",
        locator: "line:1:column:1",
        currentReference: "![[Target#Plan|preview]]",
        replacement: "![[Guides/Renamed Guide#Plan|preview]]"
      },
      {
        sourcePath: "Work/Home.md",
        sourceRevision: "memory-0",
        locator: "line:2:column:1",
        currentReference: "![Diagram](../Target.md#plan)",
        replacement: "![Diagram](../Guides/Renamed%20Guide.md#plan)"
      }
    ]);
  });
});
