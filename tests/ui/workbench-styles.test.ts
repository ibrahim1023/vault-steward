import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("focused review workbench styles", () => {
  it("stacks the workbench from its pane width rather than the desktop viewport", () => {
    const styles = readFileSync(resolve(root, "styles.css"), "utf8");

    expect(styles).toContain("container-name: steward-workspace;");
    expect(styles).toContain("container-type: inline-size;");
    expect(styles).toContain("@container steward-workspace (max-width: 680px)");
    expect(styles).toMatch(
      /@container steward-workspace \(max-width: 680px\)[\s\S]*?\.review-workbench\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/
    );
    expect(styles).not.toContain("@media (max-width: 680px)");
  });

  it("lets source-aware queue rows grow and wrap inside Obsidian panes", () => {
    const styles = readFileSync(resolve(root, "styles.css"), "utf8");

    expect(styles).toMatch(
      /\[aria-label="Priority findings"\] button\.finding-row\s*\{[\s\S]*?display: grid;[\s\S]*?height: auto;[\s\S]*?white-space: normal;/
    );
    expect(styles).toMatch(/\.finding-row-source\s*\{[\s\S]*?overflow-wrap: anywhere;/);
  });
});
