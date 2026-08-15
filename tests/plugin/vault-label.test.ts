import { describe, expect, it } from "vitest";

import { displayVaultName } from "../../src/plugin/vault-label.js";

describe("displayVaultName", () => {
  it("uses the active Obsidian vault name in preference to a saved fallback", () => {
    expect(displayVaultName("Northstar Acceptance", "Current vault")).toBe("Northstar Acceptance");
  });

  it("uses the saved fallback only when no active vault name is available", () => {
    expect(displayVaultName("  ", "Current vault")).toBe("Current vault");
  });
});
