import { describe, expect, it } from "vitest";

import {
  createReleaseManifest,
  supportsObsidianVersion,
  validatePluginManifest
} from "../../src/packaging/release-manifest.js";

describe("release packaging contracts", () => {
  it("validates an Obsidian desktop manifest and supported app versions", () => {
    expect(
      validatePluginManifest({
        id: "vault-steward",
        name: "Vault Steward",
        version: "0.1.0",
        minAppVersion: "1.5.0",
        main: "main.js",
        isDesktopOnly: true
      })
    ).toEqual([]);
    expect(supportsObsidianVersion("1.5.0", "1.5.0")).toBe(true);
    expect(supportsObsidianVersion("1.6.0", "1.5.0")).toBe(true);
    expect(supportsObsidianVersion("1.4.9", "1.5.0")).toBe(false);
  });

  it("creates a release record bound to the plugin version and artifacts", () => {
    expect(
      createReleaseManifest(
        {
          id: "vault-steward",
          name: "Vault Steward",
          version: "0.1.0",
          minAppVersion: "1.5.0",
          main: "main.js",
          isDesktopOnly: true
        },
        [
          { path: "main.js", sha256: "a".repeat(64) },
          { path: "manifest.json", sha256: "b".repeat(64) },
          { path: "styles.css", sha256: "c".repeat(64) }
        ]
      )
    ).toMatchObject({
      schemaVersion: 1,
      version: "0.1.0",
      artifacts: { "main.js": "a".repeat(64) }
    });
  });
});
