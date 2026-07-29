import { describe, expect, it } from "vitest";

import {
  comparePromptRegistries,
  PROMPT_REGISTRY,
  promptRegistryFingerprint,
  validatePromptRegistry
} from "../../src/observability/prompt-registry.js";

describe("prompt registry", () => {
  it("provides immutable hashes without prompt text", () => {
    expect(PROMPT_REGISTRY).toHaveLength(4);
    expect(promptRegistryFingerprint()).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(PROMPT_REGISTRY)).not.toMatch(/UNTRUSTED_VAULT_DATA|Return JSON/i);
  });

  it("compares registry changes and rejects invalid entries", () => {
    expect(
      comparePromptRegistries(PROMPT_REGISTRY, [
        ...PROMPT_REGISTRY.filter((entry) => entry.agent !== "entity"),
        { ...PROMPT_REGISTRY[0]!, version: "v2" }
      ])
    ).toEqual([{ agent: "entity", change: "changed" }]);
    expect(() => validatePromptRegistry([{ ...PROMPT_REGISTRY[0]!, hash: "prompt body" }])).toThrow(
      "invalid"
    );
  });
});
