import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin manifest", () => {
  it("declares an Obsidian-compatible plugin entry point", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(import.meta.dirname, "../../manifest.json"), "utf8")
    ) as {
      id: string;
      main: string;
      minAppVersion: string;
      version: string;
    };

    expect(manifest.id).toBe("vault-steward");
    expect(manifest.main).toBe("main.js");
    expect(manifest.minAppVersion).toMatch(/^1\./);
    expect(manifest.version).toMatch(/^0\.1\.0$/);
  });
});
