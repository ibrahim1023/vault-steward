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
  "docs/release-compatibility.md",
  "docs/northstar-release-workflow.md",
  "docs/release-quality-report.md",
  "docs/community-plugin-submission-checklist.md"
];

describe("public documentation", () => {
  it("links the required verified documentation from a phase-free README", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    expect(readme).toContain("## Privacy And Safety");
    expect(readme).toContain("## Field Engineering Foundations");
    expect(readme).toContain("not a claim of");
    expect(readme).toContain("## How It Works");
    expect(readme).toContain("Check vault");
    expect(readme).toContain("current and proposed references");
    expect(readme).toContain("expected result");
    expect(readme).toContain("Apply fixes");
    expect(readme).toContain("## Evaluation And Observability");
    expect(readme).toContain("Settings");
    expect(readme).toContain("History");
    expect(readme).toContain("Diagnostics");
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

  it("documents the simple result-first flow and separate utility surfaces", () => {
    const suite = readFileSync(resolve(root, "docs/manual-acceptance-suite.md"), "utf8");
    const checklist = readFileSync(resolve(root, "docs/manual-acceptance-checklist.md"), "utf8");

    expect(suite).toContain("Check vault");
    expect(suite).toContain("Current");
    expect(suite).toContain("After");
    expect(suite).toContain("Expected result");
    expect(suite).toContain("Apply fixes");
    expect(suite).toContain("Settings");
    expect(suite).toContain("History");
    expect(suite).toContain("Diagnostics");
    expect(checklist).toContain("one dominant action");
    expect(checklist).toContain("expected result");
    expect(checklist).toContain("actual result");
  });

  it("keeps platform and cloud-provider release claims bounded", () => {
    const compatibility = readFileSync(resolve(root, "docs/release-compatibility.md"), "utf8");
    const troubleshooting = readFileSync(resolve(root, "docs/troubleshooting.md"), "utf8");
    const privacy = readFileSync(resolve(root, "PRIVACY.md"), "utf8");

    expect(compatibility).toContain("limited to macOS");
    expect(compatibility).toContain("HyperFusion has a passing redacted synthetic-corpus report");
    expect(compatibility).toContain("OpenAI is experimental");
    expect(troubleshooting).toContain("HyperFusion is experimental");
    expect(privacy).toContain("HyperFusion and OpenAI are optional, explicit cloud providers");
  });
});
