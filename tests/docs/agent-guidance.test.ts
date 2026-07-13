import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const requiredHeadings = [
  "When to use this skill",
  "When not to use this skill",
  "Required context",
  "Files and directories covered",
  "Authoritative project documents",
  "Project conventions",
  "Recommended workflow",
  "Best practices",
  "Common mistakes",
  "Required tests and checks",
  "Completion criteria"
];

describe("agent guidance", () => {
  it("keeps project skills structured and documents every implemented command", async () => {
    for (const skill of [
      "vault-steward-typescript",
      "vault-steward-ai-workflows",
      "vault-steward-testing-evals"
    ]) {
      const content = await readFile(resolve(root, "skills", skill, "SKILL.md"), "utf8");
      for (const heading of requiredHeadings) {
        expect(content).toContain(`## ${heading}`);
      }
    }

    const agents = await readFile(resolve(root, "AGENTS.md"), "utf8");
    const pressureScenarios = await readFile(
      resolve(root, "tests/docs/skill-pressure-scenarios.md"),
      "utf8"
    );
    const packageManifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(agents).toContain("## Commands");
    expect(agents).not.toContain("## Planned Commands");
    for (const command of [
      "format:check",
      "lint",
      "typecheck",
      "build",
      "test:unit",
      "test:integration",
      "test:e2e",
      "eval:smoke",
      "eval:full",
      "security:check"
    ]) {
      expect(packageManifest.scripts[command]).toBeDefined();
      expect(agents).toContain(`npm run ${command}`);
    }

    expect(pressureScenarios).toContain("## TypeScript Boundary");
    expect(pressureScenarios).toContain("## Model Authority");
    expect(pressureScenarios).toContain("## Evaluation Shortcut");
  });
});
