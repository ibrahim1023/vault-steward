import { describe, expect, it } from "vitest";

import { runGovernedScan } from "../../src/core/governed-scan.js";
import type { LocalProvider } from "../../src/model-provider/local-provider.js";

const provider: LocalProvider = {
  config: {
    kind: "ollama",
    endpoint: "http://127.0.0.1:11434",
    model: "test",
    timeoutMs: 100,
    maxResponseBytes: 1_000
  },
  capabilities: ["structured-output"],
  generate: async () => ({
    text: '{"candidates":[]}',
    provider: "ollama",
    model: "test",
    latencyMs: 1
  })
};

describe("snapshot-derived governed scan", () => {
  it("returns normalized reference and task findings from one immutable snapshot", async () => {
    const result = await runGovernedScan(
      [
        {
          path: "Home.md",
          content: "[[Missing]]\n\n- [ ] Launch due:2025-01-01 ^launch"
        }
      ],
      [provider],
      "2026-07-14T00:00:00Z"
    );

    expect(result.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining(["broken-reference", "task"])
    );
    expect(result.completed).toBe(true);
    expect(result.modelTraces).toEqual([
      expect.objectContaining({ provider: "ollama", outcome: "success" })
    ]);
  });

  it("derives configured schema and policy findings from the same snapshot", async () => {
    const result = await runGovernedScan(
      [{ path: "Project.md", content: "---\nkind: project\nstatus: archived\n---\nProject" }],
      [provider],
      "2026-07-14T00:00:00Z",
      {
        schemas: [{ required: ["owner"] }],
        policies: [
          {
            id: "project-owner",
            version: 1,
            enabled: true,
            templates: [],
            rules: [
              {
                id: "owner-required",
                fact: "project.owner",
                operator: "required",
                severity: "medium"
              }
            ]
          }
        ]
      }
    );

    expect(result.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining(["schema", "policy"])
    );
  });

  it("emits schema findings only for activated, unambiguous policy templates", async () => {
    const result = await runGovernedScan(
      [{ path: "Projects/Atlas.md", content: "---\nkind: project\n---\n# Atlas" }],
      [provider],
      "2026-07-14T00:00:00Z",
      {
        policies: [
          { id: "project-template", version: 1, enabled: true, templates: ["project"], rules: [] }
        ]
      }
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "schema", explanation: "Project notes require 'owner'." }),
        expect.objectContaining({ type: "schema", explanation: "Project notes require 'status'." })
      ])
    );
  });

  it("does not report a completed scan when the required local model stage fails", async () => {
    const result = await runGovernedScan(
      [{ path: "Home.md", content: "[[Missing]]" }],
      [],
      "2026-07-14T00:00:00Z"
    );

    expect(result).toMatchObject({ completed: false, findings: [] });
    expect(result.limitations).toContain("local-model-provider-required");
  });

  it("keeps deterministic integrity checks available when model output is malformed", async () => {
    const malformedProvider: LocalProvider = {
      ...provider,
      generate: async () => ({
        text: "this is not JSON",
        provider: "ollama",
        model: "test",
        latencyMs: 1
      })
    };

    const result = await runGovernedScan(
      [{ path: "Home.md", content: "[[Missing]]" }],
      [malformedProvider],
      "2026-07-14T00:00:00Z"
    );

    expect(result.completed).toBe(true);
    expect(result.findings.map((finding) => finding.type)).toContain("broken-reference");
    expect(result.limitations).toContain("local-model-output-unavailable");
  });
});
