import { describe, expect, it } from "vitest";

import {
  createReferenceFindingIdentity,
  FINDING_IDENTITY_PROFILE_HASH
} from "../../src/findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../../src/findings/normalize.js";
import { openPluginDatabase, type PluginDatabase } from "../../src/plugin/database.js";

const locateFile = (file: string) => `node_modules/sql.js/dist/${file}`;

async function fixture() {
  return openPluginDatabase({
    adapter: {
      exists: async () => false,
      readBinary: async () => new ArrayBuffer(0),
      writeBinary: async () => undefined
    },
    databasePath: "vault-steward.sqlite",
    locateFile
  });
}

function finding(scanId: string, target: string, revision = "r1") {
  const evidence: PromotedEvidence = {
    notePath: "Home.md",
    locator: "line:1",
    excerpt: `[[${target}]]`,
    role: "reference",
    subjectId: "subject-home",
    sourceRevision: revision
  };
  const result = normalizeFinding({
    scanId,
    type: "broken-reference",
    severity: "high",
    identity: createReferenceFindingIdentity({
      family: "broken-reference",
      subtype: "missing",
      sourceSubjectId: "subject-home",
      normalizedTarget: `${target}.md`
    }),
    evidence: [evidence],
    availableEvidence: [evidence],
    explanation: "Missing",
    confidence: 1
  });
  if (!result) throw new Error("fixture finding failed validation");
  return result;
}

function save(
  db: PluginDatabase,
  id: string,
  targets: readonly string[],
  profile = FINDING_IDENTITY_PROFILE_HASH
) {
  db.saveCompletedScan({
    id,
    vaultFingerprint: "vault",
    configHash: "config",
    inputHash: id,
    parserVersion: "parser",
    startedAt: "2026-09-29T00:00:00.000Z",
    finishedAt: `2026-09-29T00:00:0${id.slice(-1)}.000Z`,
    files: [],
    parseProducts: [],
    findings: targets.map((target) => finding(id, target)),
    modelTraces: [],
    identityProfileHash: profile
  });
}

describe("Changes Since Last Check", () => {
  it("compares two completed compatible scans without reconstructing note bodies", async () => {
    const db = await fixture();
    save(db, "scan-1", ["Old", "Same"]);
    save(db, "scan-2", ["Same", "New"]);

    const summary = db.loadChangesSummary();
    expect(summary.status).toBe("compared");
    if (summary.status !== "compared") throw new Error("expected a comparison");
    expect([summary.baselineScanId, summary.currentScanId]).toEqual(["scan-1", "scan-2"]);
    expect(summary.availableBaselineScanIds).toEqual(["scan-1"]);
    expect(summary.new.map((item) => item.stableKey)).toEqual([finding("scan-2", "New").stableKey]);
    expect(summary.new[0]).toMatchObject({
      family: "broken-reference",
      subtype: "missing",
      detail: "New.md"
    });
    expect(summary.resolved.map((item) => item.stableKey)).toEqual([
      finding("scan-1", "Old").stableKey
    ]);
    expect(summary.unchanged.map((item) => item.stableKey)).toEqual([
      finding("scan-2", "Same").stableKey
    ]);
    expect(JSON.stringify(summary)).not.toContain("[[");
    db.close();
  });

  it("supports a retained compatible baseline and rejects invalid selection", async () => {
    const db = await fixture();
    save(db, "scan-1", ["Old"]);
    save(db, "scan-2", [], "a".repeat(64));
    save(db, "scan-3", []);
    save(db, "scan-4", ["Old"]);

    const recent = db.loadChangesSummary();
    expect(recent.status).toBe("compared");
    if (recent.status !== "compared") throw new Error("expected comparison");
    expect(recent.availableBaselineScanIds).toEqual(["scan-1", "scan-3"]);
    expect(recent.recurring).toHaveLength(1);
    const selected = db.loadChangesSummary("scan-1");
    expect(selected.status).toBe("compared");
    if (selected.status !== "compared") throw new Error("expected comparison");
    expect(selected.baselineScanId).toBe("scan-1");
    expect(selected.unchanged).toHaveLength(1);
    expect(() => db.loadChangesSummary("scan-2")).toThrow("retained compatible");
    expect(() => db.loadChangesSummary("scan-4")).toThrow("retained compatible");
    db.close();
  });

  it("does not compare first, legacy, or failed scans", async () => {
    const db = await fixture();
    expect(db.loadChangesSummary()).toEqual({ status: "no-scan", currentScanId: null });
    save(db, "scan-1", ["Old"]);
    expect(db.loadChangesSummary()).toMatchObject({ status: "baseline", currentScanId: "scan-1" });
    save(db, "scan-2", [], "legacy");
    expect(db.loadChangesSummary()).toEqual({ status: "legacy", currentScanId: "scan-2" });
    save(db, "scan-3", []);
    expect(db.loadChangesSummary()).toMatchObject({ status: "compared", baselineScanId: "scan-1" });
    db.repository.saveScan({
      id: "scan-4",
      vaultFingerprint: "vault",
      startedAt: "2026-09-29T00:00:00.000Z",
      finishedAt: "2026-09-29T00:00:04.000Z",
      status: "failed",
      configHash: "config",
      inputHash: "scan-4",
      parserVersion: "parser",
      identityProfileHash: FINDING_IDENTITY_PROFILE_HASH
    });
    expect(db.loadChangesSummary()).toMatchObject({ status: "compared", currentScanId: "scan-3" });
    db.close();
  });
});
