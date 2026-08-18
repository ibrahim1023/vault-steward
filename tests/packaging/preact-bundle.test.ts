import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("production UI bundle", () => {
  it("contains no dynamic script-element creation or Node filesystem fallback", async () => {
    const bundle = await readFile(resolve(import.meta.dirname, "../../main.js"), "utf8");

    expect(bundle).not.toContain('createElement("script")');
    expect(bundle).not.toMatch(/node:fs|require\("fs"\)/);
  });
});
