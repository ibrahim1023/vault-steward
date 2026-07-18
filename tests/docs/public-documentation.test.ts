import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const requiredPublicDocs = [
  "EVALS.md",
  "OBSERVABILITY.md",
  "PRIVACY.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "ROADMAP.md",
  "CHANGELOG.md",
  "docs/local-models.md",
  "docs/troubleshooting.md",
  "docs/release-compatibility.md"
];

describe("public documentation", () => {
  it("links the required verified documentation from a phase-free README", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    expect(readme).toContain("## Privacy And Safety");
    expect(readme).toContain("## How It Works");
    expect(readme).toContain("## Evaluation And Observability");
    expect(readme).not.toMatch(/\bPhase\s+1[0-9]\b/i);
    expect(readme).not.toMatch(/Community Plugins|Obsidian marketplace/i);
    expect(readme).not.toMatch(/sends? remote telemetry|cloud analytics/i);
    for (const document of requiredPublicDocs) {
      expect(existsSync(resolve(root, document))).toBe(true);
      expect(readme).toContain(`](${document})`);
    }
  });

  it("documents only package scripts or explicit local setup commands", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const commands = [...readme.matchAll(/npm run ([a-z0-9:-]+)/g)].map((match) => match[1]!);

    expect(commands).toContain("eval:synthetic");
    expect(commands.every((command) => command in packageJson.scripts)).toBe(true);
  });
});
