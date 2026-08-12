import { describe, expect, it } from "vitest";

import {
  prepareContradictionPropositions,
  runContradictionAgent,
  runDecisionAgent,
  runEntityAgent,
  runStalenessAgent,
  validateEntityCandidates
} from "../../src/agents/model-assisted.js";
import type { ModelProvider } from "../../src/model-provider/local-provider.js";

function provider(response: string): ModelProvider {
  return {
    config: {
      kind: "ollama",
      endpoint: "http://localhost:11434",
      model: "test",
      timeoutMs: 100,
      maxResponseBytes: 10_000
    },
    capabilities: ["structured-output"],
    generate: async () => ({ text: response, model: "test", provider: "ollama", latencyMs: 1 })
  };
}

const evidence = [
  { notePath: "People/Ada.md", locator: "line:1", excerpt: "Ada Lovelace leads research." },
  { notePath: "Projects/Research.md", locator: "line:4", excerpt: "Ada L. owns research." },
  { notePath: "Status.md", locator: "line:2", excerpt: "Project Aurora is active." }
];

describe("model-assisted agents", () => {
  it("accepts only entity candidates with two distinct active evidence locators", async () => {
    expect(
      validateEntityCandidates(
        [{ kind: "alias", labels: ["Ada Lovelace", "Ada L."], evidence: evidence.slice(0, 2) }],
        evidence
      )
    ).toHaveLength(1);
    expect(
      validateEntityCandidates(
        [
          {
            kind: "alias",
            labels: ["Ada Lovelace", "Ada L."],
            evidence: [evidence[0]!, evidence[0]!]
          }
        ],
        evidence
      )
    ).toEqual([]);
    const result = await runEntityAgent({ scanId: "scan", evidence }, [
      provider(
        JSON.stringify({
          candidates: [
            { kind: "alias", labels: ["Ada Lovelace", "Ada L."], evidence: evidence.slice(0, 2) }
          ]
        })
      )
    ]);
    expect(result.candidates[0]).toMatchObject({
      kind: "alias",
      labels: ["Ada Lovelace", "Ada L."]
    });
  });

  it("prepares propositions deterministically and rejects uncited or ambiguous conflicts", async () => {
    const propositions = prepareContradictionPropositions([
      { ...evidence[0]!, statement: "Aurora status is active" },
      { ...evidence[1]!, statement: "Aurora status is blocked" }
    ]);
    expect(propositions).toHaveLength(2);
    const result = await runContradictionAgent({ scanId: "scan", evidence, propositions }, [
      provider(
        JSON.stringify({
          candidates: [
            { left: propositions[0], right: propositions[1], explanation: "status conflict" }
          ]
        })
      )
    ]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.severity).toBe("low");
  });

  it("uses deterministic staleness eligibility and cited ambiguous decision candidates", async () => {
    const stale = await runStalenessAgent(
      {
        scanId: "scan",
        now: "2026-07-13T00:00:00Z",
        records: [
          {
            ...evidence[0]!,
            updatedAt: "2025-01-01T00:00:00Z",
            projectStatus: "active",
            archival: false
          },
          {
            ...evidence[1]!,
            updatedAt: "2025-01-01T00:00:00Z",
            projectStatus: "archived",
            archival: true
          }
        ]
      },
      [
        provider(
          JSON.stringify({
            candidates: [{ evidence: evidence[0]!, explanation: "old active record" }]
          })
        )
      ]
    );
    expect(stale.candidates).toHaveLength(1);
    const decisions = await runDecisionAgent(
      {
        scanId: "scan",
        decisions: [
          { id: "D1", rationale: null, supersedes: null, evidence: evidence[0]! },
          { id: "D2", rationale: "documented", supersedes: "D1", evidence: evidence[1]! }
        ]
      },
      [
        provider(
          JSON.stringify({
            candidates: [
              { decisionId: "D1", evidence: evidence[0]!, explanation: "supersession is ambiguous" }
            ]
          })
        )
      ]
    );
    expect(decisions.candidates).toHaveLength(1);
  });
});
