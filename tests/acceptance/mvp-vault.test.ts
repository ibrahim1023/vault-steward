import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { LocalAgentCoordinator } from "../../src/agents/coordinator.js";
import type { AgentEvidence } from "../../src/agents/model-assisted.js";
import { checkDecisions, indexDecision } from "../../src/decisions/index.js";
import type { LocalProvider } from "../../src/model-provider/local-provider.js";
import { evaluatePolicies, extractPolicyFacts } from "../../src/policy/evaluate.js";
import { parsePolicy } from "../../src/policy/parse.js";
import { checkReferenceIntegrity } from "../../src/reference/check.js";
import { proposeFix } from "../../src/review/propose.js";
import { ReviewWorkflow } from "../../src/review/workflow.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";
import { validateSchema } from "../../src/schema/check.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";
import { checkTasks } from "../../src/tasks/check.js";

const provider: LocalProvider = {
  config: {
    kind: "ollama",
    endpoint: "http://127.0.0.1:11434",
    model: "acceptance-fixture",
    timeoutMs: 100,
    maxResponseBytes: 10_000
  },
  capabilities: ["structured-output"],
  generate: async () => ({
    text: '{"candidates":[]}',
    provider: "ollama",
    model: "acceptance-fixture",
    latencyMs: 1
  })
};

describe("MVP acceptance vault", () => {
  it("detects every deterministic issue family against a synthetic vault", () => {
    const snapshot = scanVaultFiles([{ path: "Home.md", content: "[[Missing]]" }]);
    expect(checkReferenceIntegrity(snapshot)).toHaveLength(1);
    expect(
      checkTasks("- [ ] Old owner:ada project:atlas due:2026-01-01 ^old", "2026-07-14T00:00:00Z")
    ).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "overdue" })]));
    expect(
      validateSchema({ template: "project", status: "unknown" }, [
        { template: "project", required: ["owner"], enums: { status: ["open"] }, types: {} }
      ])
    ).toHaveLength(2);

    const first = indexDecision("Decisions/A.md", {
      kind: "decision",
      supersedes: "Decisions/B.md"
    });
    const second = indexDecision("Decisions/B.md", {
      kind: "decision",
      supersedes: "Decisions/A.md"
    });
    if (!first || !second) throw new Error("acceptance decision fixture was not indexed");
    expect(checkDecisions([first, second])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "missing-rationale" }),
        expect.objectContaining({ kind: "supersedes-cycle" })
      ])
    );

    const policy = parsePolicy(
      `id: acceptance\nversion: 1\nrules:\n  - { id: owner, fact: project.owner, operator: required, severity: high }`
    );
    if (!policy.ok) throw new Error(policy.diagnostics.join(", "));
    expect(
      evaluatePolicies(
        [policy.value],
        extractPolicyFacts([{ path: "Projects/Atlas.md", frontmatter: { kind: "project" } }])
      )
    ).toEqual([expect.objectContaining({ ruleId: "owner" })]);
  });

  it("requires a local-model coordinator, exposes every eligible route once, and terminates", async () => {
    const evidence: [AgentEvidence, AgentEvidence] = [
      { notePath: "A.md", locator: "line:1", excerpt: "Aurora is active." },
      { notePath: "B.md", locator: "line:1", excerpt: "Aurora is blocked." }
    ];
    const result = await new LocalAgentCoordinator([provider]).run({
      scanId: "acceptance",
      now: "2026-07-14T00:00:00Z",
      evidence,
      propositions: [
        { ...evidence[0], statement: "Aurora is active." },
        { ...evidence[1], statement: "Aurora is blocked." }
      ],
      stalenessRecords: [
        {
          ...evidence[0],
          updatedAt: "2026-01-01T00:00:00Z",
          projectStatus: "active",
          archival: false
        }
      ],
      decisions: [{ id: "D1", rationale: null, supersedes: null, evidence: evidence[0] }]
    });
    expect(result.routes).toEqual(["entity", "contradiction", "staleness", "decision"]);
    expect(result.toolCalls).toBe(4);
    expect(result).toMatchObject({ completed: true, terminated: true, modelRequired: true });
  });

  it("previews an approved repair, applies it, and requests re-index only after the write", async () => {
    const snapshot = scanVaultFiles([{ path: "Home.md", content: "See [[Missing]]" }]);
    const finding = checkReferenceIntegrity(snapshot)[0];
    if (!finding) throw new Error("acceptance reference fixture did not produce a finding");
    const proposed = proposeFix(
      finding,
      { path: "Home.md", revision: "r1", content: "See [[Missing]]" },
      "Target"
    );
    if (!proposed.applicable) throw new Error(proposed.reason);

    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: finding.scanId,
      vaultFingerprint: "vault",
      startedAt: "now",
      finishedAt: null,
      status: "running",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    repository.saveFinding({
      id: finding.id,
      scanId: finding.scanId,
      type: finding.type,
      severity: finding.severity,
      status: finding.status,
      evidenceJson: JSON.stringify(finding.evidence),
      payloadJson: "{}"
    });
    repository.saveProposal({
      id: proposed.proposal.id,
      findingId: finding.id,
      patchJson: JSON.stringify(proposed.proposal),
      sourceRevisionsJson: "{}",
      status: "pending"
    });
    let content = "See [[Missing]]";
    let reindexes = 0;
    const workflow = new ReviewWorkflow(repository, {
      read: async () => ({ content, revision: "r1" }),
      write: async (_path, next) => {
        content = next;
      }
    });
    await expect(workflow.apply(proposed.proposal, "before-approval")).rejects.toThrow(
      "Only approved"
    );
    workflow.act(proposed.proposal, "approved", "approved-at");
    await expect(
      workflow.apply(proposed.proposal, "applied-at", { onReindex: () => reindexes++ })
    ).resolves.toEqual({ ok: true });
    expect(content).toBe("See [[Target]]");
    expect(reindexes).toBe(1);
  });
});
