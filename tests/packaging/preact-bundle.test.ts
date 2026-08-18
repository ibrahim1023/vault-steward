import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);

describe("production UI bundle", () => {
  beforeAll(async () => {
    await run(process.execPath, ["esbuild.config.mjs"], {
      cwd: resolve(import.meta.dirname, "../..")
    });
  });

  it("contains no dynamic script-element creation or Node filesystem fallback", async () => {
    const bundle = await readFile(resolve(import.meta.dirname, "../../main.js"), "utf8");

    expect(bundle).not.toContain('createElement("script")');
    expect(bundle).not.toMatch(/node:fs|require\("fs"\)/);
  });
});
