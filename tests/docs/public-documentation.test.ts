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
  "docs/local-models.md",
  "docs/troubleshooting.md",
  "docs/release-compatibility.md",
  "docs/release-readiness.md",
  "docs/upgrade-notes.md",
  "docs/known-limitations.md"
];

describe("public documentation", () => {
  it("links the required verified documentation from a phase-free README", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    expect(readme).toContain("## Keep your vault trustworthy");
    expect(readme).toContain("## The simple flow");
    expect(readme).toContain("Check vault");
    expect(readme).toContain("**Current** and **After**");
    expect(readme).toContain("Apply fixes");
    expect(readme).toContain("## Coordinated review, not autonomous editing");
    expect(readme).toContain("## Choose a model provider");
    expect(readme).toContain("## Privacy and safety");
    expect(readme).toContain("## Install and get started");
    expect(readme).toContain("## Limitations");
    expect(readme).toContain("## Documentation");
    expect(readme).toContain("## Development");
    expect(readme).not.toMatch(/\bPhase\s+1[0-9]\b/i);
    expect(readme).not.toMatch(/Community Plugins|Obsidian marketplace/i);
    expect(readme).not.toMatch(/sends? remote telemetry|cloud analytics/i);
    for (const document of requiredPublicDocs) {
      expect(existsSync(resolve(root, document))).toBe(true);
      expect(readme).toContain(`](${document})`);
    }
  });

  it("keeps platform and cloud-provider release claims bounded", () => {
    const compatibility = readFileSync(resolve(root, "docs/release-compatibility.md"), "utf8");
    const troubleshooting = readFileSync(resolve(root, "docs/troubleshooting.md"), "utf8");
    const privacy = readFileSync(resolve(root, "PRIVACY.md"), "utf8");

    expect(compatibility).toContain("limited to macOS");
    expect(compatibility).toContain("HyperFusion and OpenAI are experimental");
    expect(troubleshooting).toContain("HyperFusion is experimental");
    expect(privacy).toContain("HyperFusion and OpenAI are optional, explicit cloud providers");
    expect(privacy).toContain("OpenAI acknowledgement never authorizes HyperFusion");
    expect(privacy).toContain("does not modify vault notes or approval history");
  });

  it("keeps policy recovery and approval boundaries explicit", () => {
    const security = readFileSync(resolve(root, "SECURITY.md"), "utf8");
    const troubleshooting = readFileSync(resolve(root, "docs/troubleshooting.md"), "utf8");

    expect(security).toContain("private vulnerability-reporting route");
    expect(security).toContain("fail closed");
    expect(security).toContain("[full threat model](docs/security.md)");
    expect(troubleshooting).toContain("## Custom Policy File Error");
    expect(troubleshooting).toContain(".vault-steward/policy.yaml");
    expect(troubleshooting).toContain("## Failed or Interrupted Apply");
    expect(troubleshooting).toContain("fresh explicit approval");
  });

  it("keeps release readiness and security status current", () => {
    const readiness = readFileSync(resolve(root, "docs/release-readiness.md"), "utf8");
    const security = readFileSync(resolve(root, "docs/security.md"), "utf8");
    const compatibility = readFileSync(resolve(root, "docs/release-compatibility.md"), "utf8");
    const upgrade = readFileSync(resolve(root, "docs/upgrade-notes.md"), "utf8");

    expect(readiness).toContain("Release owner sign-off");
    expect(readiness).toContain("Upstream submission is a separate owner action");
    expect(security).toContain("completed deep-security scan");
    expect(security).not.toContain("could not create a new report");
    expect(compatibility).toContain("HyperFusion and OpenAI are experimental");
    expect(upgrade).not.toContain("Policy Studio stores");
  });

  it("keeps the open security-assurance release condition visible to owners", () => {
    const edgeCases = readFileSync(resolve(root, "docs/security-test-edge-cases.md"), "utf8");
    const readiness = readFileSync(resolve(root, "docs/release-readiness.md"), "utf8");
    const limitations = readFileSync(resolve(root, "docs/known-limitations.md"), "utf8");
    const review = readFileSync(resolve(root, "docs/release-review.md"), "utf8");

    expect(edgeCases).toMatch(/open\s+security-assurance\s+gap/i);
    expect(edgeCases).toMatch(/release-owner\s+risk\s+disposition/i);
    expect(readiness).toMatch(/security-assurance[\s\S]{0,80}risk disposition/i);
    expect(limitations).toMatch(/security-assurance[\s\S]{0,80}risk disposition/i);
    expect(review).toMatch(/macOS acceptance retest\s+passed/i);
    expect(review).not.toContain("npm run eval:marketplace:gate");
  });

  it("keeps release records free of local paths and obsolete manual-release gates", () => {
    const manualAcceptance = readFileSync(
      resolve(root, "docs/manual-acceptance-checklist.md"),
      "utf8"
    );
    const progress = readFileSync(resolve(root, "docs/progress.md"), "utf8");

    expect(manualAcceptance).not.toMatch(/\/(?:Users|home)\//);
    expect(progress).toContain("Release-owner preparation is the current work.");
    expect(progress).toMatch(
      /current macOS manual\s+acceptance matrix and Phase 30 release evidence/
    );
    expect(progress).not.toContain("cumulative manual Obsidian acceptance pass remains deferred");
    expect(progress).not.toContain(
      "deferred Phase 19 manual desktop matrix and Phases 21-22 release evidence"
    );
  });
});
