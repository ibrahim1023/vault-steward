import { describe, expect, it } from "vitest";

import { pluginInstallPath, requiredInstallArtifacts } from "../../src/packaging/install.js";

describe("plugin install harness", () => {
  it("targets only the Obsidian plugin directory and declares complete release artifacts", () => {
    expect(pluginInstallPath("/vault", "vault-steward")).toBe(
      "/vault/.obsidian/plugins/vault-steward"
    );
    expect(requiredInstallArtifacts()).toEqual([
      "main.js",
      "manifest.json",
      "sql-wasm.wasm",
      "release-manifest.json"
    ]);
    expect(() => pluginInstallPath("/vault", "../unsafe")).toThrow("safe slug");
  });
});
