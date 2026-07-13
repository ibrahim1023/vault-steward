import { describe, expect, it } from "vitest";

import { parsePolicy } from "../../src/policy/parse.js";

describe("policy parser", () => {
  it("accepts a bounded versioned policy", () => {
    expect(
      parsePolicy(`
id: project-owner
version: 1
enabled: true
rules:
  - id: require-owner
    fact: project.owner
    operator: required
    severity: high
`)
    ).toEqual({
      ok: true,
      value: {
        id: "project-owner",
        version: 1,
        enabled: true,
        rules: [
          { id: "require-owner", fact: "project.owner", operator: "required", severity: "high" }
        ]
      }
    });
  });

  it("returns diagnostics for malformed, unknown, and oversized input", () => {
    expect(parsePolicy("id: [not-a-string]")).toMatchObject({
      ok: false,
      diagnostics: expect.any(Array)
    });
    expect(parsePolicy("id: valid\nversion: 1\nextra: no")).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.stringContaining("unknown field")])
    });
    expect(parsePolicy("x".repeat(32_769))).toEqual({
      ok: false,
      diagnostics: ["policy exceeds the 32768-byte limit"]
    });
  });
});
