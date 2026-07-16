import { describe, expect, it } from "vitest";
import { validateReleaseCompatibility } from "../../src/release/compatibility.js";
describe("release compatibility", () =>
  it("requires matching versions and complete desktop artifacts", () => {
    expect(
      validateReleaseCompatibility({
        manifestVersion: "0.1.0",
        packageVersion: "0.1.0",
        artifacts: [
          "main.js",
          "manifest.json",
          "sql-wasm.wasm",
          "styles.css",
          "release-manifest.json"
        ]
      })
    ).toEqual([]);
    expect(
      validateReleaseCompatibility({ manifestVersion: "1", packageVersion: "2", artifacts: [] })
    ).not.toEqual([]);
  }));
