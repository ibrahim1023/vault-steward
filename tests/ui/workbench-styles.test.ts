import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("simple review styles", () => {
  it("uses a stable pane-responsive result preview", () => {
    const styles = readFileSync(resolve(root, "styles.css"), "utf8");

    expect(styles).toContain("container-name: steward-workspace;");
    expect(styles).toContain("container-type: inline-size;");
    expect(styles).toContain("@container steward-workspace (max-width: 620px)");
    expect(styles).toMatch(
      /@container steward-workspace \(max-width: 620px\)[\s\S]*?\.repair-change\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/
    );
  });

  it("keeps exact reference previews readable and uses a green primary action", () => {
    const styles = readFileSync(resolve(root, "styles.css"), "utf8");

    expect(styles).toMatch(/\.repair-reference\s*\{[\s\S]*?white-space: pre-wrap;/);
    expect(styles).toMatch(/\.steward-primary\s*\{[\s\S]*?background: var\(--steward-green\);/);
    expect(styles).toMatch(/\.target-status\s*\{[\s\S]*?color:/);
  });
});
