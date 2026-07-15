import { describe, expect, it } from "vitest";

import { DiagnosticRegistry } from "../../src/diagnostics/registry.js";

describe("local diagnostics", () => {
  it("retains bounded, correlation-addressable diagnostics without sensitive causes", () => {
    const registry = new DiagnosticRegistry(2);
    registry.record({
      correlationId: "scan-1",
      code: "provider-unavailable",
      cause: "prompt: secret from /Users/person/Vault/Private.md"
    });
    registry.record({ correlationId: "scan-2", code: "migration-failed" });
    registry.record({ correlationId: "scan-3", code: "index-rebuild-required" });

    const diagnostics = registry.list();
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((diagnostic) => diagnostic.correlationId)).toEqual(["scan-2", "scan-3"]);
    expect(JSON.stringify(diagnostics)).not.toContain("secret");
    expect(JSON.stringify(diagnostics)).not.toContain("/Users");
  });

  it("summarizes outcome codes without including vault content", () => {
    const registry = new DiagnosticRegistry();
    registry.record({ correlationId: "apply-1", code: "apply-reindex-mismatch" });
    registry.record({ correlationId: "apply-2", code: "apply-reindex-mismatch" });
    expect(registry.summary()).toEqual({ "apply-reindex-mismatch": 2 });
  });
});
