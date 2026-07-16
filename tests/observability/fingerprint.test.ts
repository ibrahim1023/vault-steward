import { describe, expect, it } from "vitest";

import { configurationFingerprint } from "../../src/observability/fingerprint.js";

describe("configuration fingerprints", () => {
  it("is stable across object key order and changes with a meaningful input", () => {
    const first = configurationFingerprint({
      pluginVersion: "0.1.0",
      model: { id: "llama3.1:8b", temperature: 0 },
      policy: { id: "vault-policy", version: 1 }
    });
    const reordered = configurationFingerprint({
      policy: { version: 1, id: "vault-policy" },
      model: { temperature: 0, id: "llama3.1:8b" },
      pluginVersion: "0.1.0"
    });
    const changed = configurationFingerprint({
      pluginVersion: "0.1.0",
      model: { id: "qwen2.5:7b", temperature: 0 },
      policy: { id: "vault-policy", version: 1 }
    });

    expect(first).toBe(reordered);
    expect(first).not.toBe(changed);
  });

  it("rejects content-bearing or unbounded values", () => {
    expect(() => configurationFingerprint({ prompt: "a full prompt body" })).toThrow(
      "Configuration fingerprint input is invalid."
    );
    expect(() => configurationFingerprint({ model: "x".repeat(257) })).toThrow(
      "Configuration fingerprint input is invalid."
    );
  });
});
