import { describe, expect, it } from "vitest";

import { parsePolicy } from "../../src/policy/parse.js";

describe("policy parser", () => {
  it("rejects deep nesting and aliases before YAML conversion", () => {
    const nested = Array.from({ length: 65 }, (_, index) => `${"  ".repeat(index)}x${index}:`).join(
      "\n"
    );
    expect(parsePolicy(nested)).toMatchObject({
      ok: false,
      diagnostics: [expect.stringContaining("nesting")]
    });
    expect(parsePolicy("id: p\nversion: 1\nrules: &rules []")).toMatchObject({
      ok: false,
      diagnostics: [expect.stringContaining("aliases")]
    });
  });
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
