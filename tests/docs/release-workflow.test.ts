import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("attested release workflow", () => {
  it("publishes only Community Plugins assets with provenance attestations", async () => {
    const workflow = await readFile(
      resolve(import.meta.dirname, "../../.github/workflows/release.yml"),
      "utf8"
    );

    expect(workflow).toContain('tags: ["0.*"]');
    expect(workflow).toContain("actions/attest-build-provenance@v2");
    expect(workflow).toContain("dist/vault-steward/main.js");
    expect(workflow).toContain("dist/vault-steward/manifest.json");
    expect(workflow).toContain("dist/vault-steward/styles.css");
    expect(workflow).toContain("gh release create");
    expect(workflow).not.toContain("release-manifest.json");

    const readiness = await readFile(
      resolve(import.meta.dirname, "../../docs/release-readiness.md"),
      "utf8"
    );
    expect(readiness).toContain("The release workflow is the only supported publication path.");
    expect(readiness).toMatch(/Do not create a\s+manual release for an attested version\./);
  });
});
