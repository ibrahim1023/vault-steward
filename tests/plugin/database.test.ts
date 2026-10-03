import { describe, expect, it } from "vitest";

import { openPluginDatabase } from "../../src/plugin/database.js";
import { planIncrementalScan } from "../../src/indexing/plan.js";

class MemoryBinaryStore {
  private value: Uint8Array | undefined;

  async exists(): Promise<boolean> {
    return this.value !== undefined;
  }

  async readBinary(): Promise<ArrayBuffer> {
    if (!this.value) throw new Error("database file is unavailable");
    return this.value.slice().buffer;
  }

  async writeBinary(_path: string, data: ArrayBuffer): Promise<void> {
    this.value = new Uint8Array(data.slice(0));
  }
}

class FailableBinaryStore extends MemoryBinaryStore {
  failNextWrite = false;

  override async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("writeBinary failed");
    }
    await super.writeBinary(path, data);
  }
}

const DATABASE_PATH = ".obsidian/plugins/vault-steward/vault-steward.sqlite";
const LOCATE = (file: string) => `node_modules/sql.js/dist/${file}`;

function deterministicSubjects() {
  let next = 0;
  return () => `subject-${++next}`;
}

describe("plugin database lifecycle", () => {
  it("migrates, persists, and reopens the plugin-local SQLite database", async () => {
    const store = new MemoryBinaryStore();
    const first = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    await expect(store.exists()).resolves.toBe(true);
    first.repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "now",
      finishedAt: "later",
      status: "completed",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    await first.flush();
    first.close();

    const reopened = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    expect(reopened.repository.getRecordCounts().scans).toBe(1);
    reopened.close();
  });

  it("backfills v0 occurrences for pre-existing findings when the database opens", async () => {
    const store = new MemoryBinaryStore();
    const options = () => ({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file: string) => `node_modules/sql.js/dist/${file}`
    });
    const first = await openPluginDatabase(options());
    first.repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "2026-09-28T00:00:00.000Z",
      finishedAt: "2026-09-28T00:00:01.000Z",
      status: "completed",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    first.repository.saveFinding({
      id: "finding-1",
      scanId: "scan-1",
      type: "broken-reference",
      severity: "medium",
      status: "open",
      evidenceJson: "[]",
      payloadJson: "{}"
    });
    await first.flush();
    first.close();

    const reopened = await openPluginDatabase(options());
    expect(reopened.repository.listFindingOccurrences({ scanId: "scan-1" })).toEqual([
      expect.objectContaining({
        findingId: "finding-1",
        identityVersion: 0,
        stableKey: expect.stringMatching(/^finding:v0:/)
      })
    ]);
    await reopened.flush();
    reopened.close();

    const third = await openPluginDatabase(options());
    expect(third.repository.listFindingOccurrences({ scanId: "scan-1" })).toHaveLength(1);
    third.close();
  });

  it("marks a snapshot failed when persistence after snapshot creation throws", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    const duplicateFinding = {
      schemaVersion: 1 as const,
      id: "duplicate",
      scanId: "scan-failure",
      type: "broken-reference" as const,
      severity: "medium" as const,
      evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
      affectedNoteIds: ["Home.md"],
      explanation: "Missing target",
      suggestedFixes: [],
      confidence: 1,
      status: "open" as const
    };

    expect(() =>
      database.saveCompletedScan({
        id: "scan-failure",
        vaultFingerprint: "vault",
        configHash: "config",
        inputHash: "input",
        parserVersion: "parser",
        startedAt: "2026-07-15T12:00:00.000Z",
        finishedAt: "2026-07-15T12:00:01.000Z",
        files: [],
        parseProducts: [],
        findings: [
          duplicateFinding,
          {
            ...duplicateFinding,
            evidence: [{ notePath: "Home.md", locator: "line:2", excerpt: "[[Also Missing]]" }]
          }
        ],
        modelTraces: []
      })
    ).toThrow();
    expect(database.loadHistory().scans[0]).toMatchObject({ id: "scan-failure", status: "failed" });
    database.close();
  });

  it("persists lineage only for the normalized review queue", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    const finding = (
      id: string,
      locator: string,
      excerpt: string
    ): Parameters<typeof database.saveCompletedScan>[0]["findings"][number] => ({
      schemaVersion: 1,
      id,
      scanId: "scan-normalized-lineage",
      type: "task",
      severity: "low",
      evidence: [{ notePath: "Tasks.md", locator, excerpt }],
      affectedNoteIds: ["Tasks.md"],
      explanation: "Review this task.",
      suggestedFixes: [],
      confidence: 1,
      status: "open"
    });

    database.saveCompletedScan({
      id: "scan-normalized-lineage",
      vaultFingerprint: "vault",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser",
      startedAt: "2026-08-03T12:00:00.000Z",
      finishedAt: "2026-08-03T12:00:01.000Z",
      files: [],
      parseProducts: [],
      findings: [
        finding("finding-a", "line:1", "same task"),
        finding("finding-b", "line:1", "same task"),
        finding("finding-b", "line:2", "another task")
      ],
      modelTraces: []
    });

    expect(database.loadHistory().scans[0]).toMatchObject({
      id: "scan-normalized-lineage",
      status: "completed"
    });
    expect(database.loadFindings()).toHaveLength(2);
    expect(database.loadObservability("scan-normalized-lineage").lineage).toHaveLength(2);
    database.close();
  });

  it("loads findings from only the latest completed scan", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    const createFinding = (id: string, scanId: string) => ({
      schemaVersion: 1 as const,
      id,
      scanId,
      type: "broken-reference" as const,
      severity: "medium" as const,
      evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
      affectedNoteIds: ["Home.md"],
      explanation: "Missing target",
      suggestedFixes: [],
      confidence: 1,
      status: "open" as const
    });
    const saveScan = (id: string, finishedAt: string) =>
      database.saveCompletedScan({
        id,
        vaultFingerprint: "vault",
        configHash: "config",
        inputHash: id,
        parserVersion: "parser",
        startedAt: "2026-07-15T12:00:00.000Z",
        finishedAt,
        files: [],
        parseProducts: [],
        findings: [createFinding(`finding-${id}`, id)],
        modelTraces: []
      });

    saveScan("scan-older", "2026-07-15T12:00:01.000Z");
    saveScan("scan-latest", "2026-07-15T12:00:02.000Z");

    expect(database.loadFindings()).toMatchObject([
      { id: "finding-scan-latest", scanId: "scan-latest" }
    ]);
    database.close();
  });

  it("records bounded stage spans and a configuration fingerprint for an inspectable scan", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    database.saveCompletedScan({
      id: "scan-observable",
      vaultFingerprint: "vault",
      configHash: "a".repeat(64),
      inputHash: "input",
      parserVersion: "parser",
      startedAt: "2026-07-16T00:00:00.000Z",
      finishedAt: "2026-07-16T00:00:01.000Z",
      files: [],
      parseProducts: [],
      findings: [],
      modelTraces: [],
      traceConfiguration: { fingerprint: "a".repeat(64), values: { model: "llama3.1:8b" } }
    });

    const snapshot = database.loadObservability("scan-observable");
    expect(snapshot.timeline.map((span) => span.kind)).toEqual(
      expect.arrayContaining([
        "scanner",
        "parser",
        "indexing",
        "retrieval",
        "agent",
        "validation",
        "policy",
        "coordinator",
        "finding",
        "proposal",
        "apply"
      ])
    );
    expect(snapshot.configuration).toEqual({
      fingerprint: "a".repeat(64),
      values: { model: "llama3.1:8b" }
    });
    database.close();
  });

  it("does not persist a reviewable finding when deterministic lineage is incomplete", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    database.saveCompletedScan({
      id: "scan-incomplete-lineage",
      vaultFingerprint: "vault",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser",
      startedAt: "2026-07-29T00:00:00.000Z",
      finishedAt: "2026-07-29T00:00:01.000Z",
      files: [],
      parseProducts: [],
      findings: [
        {
          schemaVersion: 1,
          id: "unsupported",
          scanId: "scan-incomplete-lineage",
          type: "task",
          severity: "low",
          evidence: [],
          affectedNoteIds: [],
          explanation: "No source evidence.",
          suggestedFixes: [],
          confidence: 1,
          status: "open"
        }
      ],
      modelTraces: []
    });
    expect(database.loadFindings()).toEqual([]);
    expect(database.loadObservability("scan-incomplete-lineage").lineage).toEqual([]);
    database.close();
  });
});

describe("note subject persistence", () => {
  it("assigns a UUID on create, retains it on modify, and does not rebind an active path", async () => {
    const database = await openPluginDatabase({
      adapter: new MemoryBinaryStore(),
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });

    const created = await database.processVaultEvents(
      [
        { schemaVersion: 1, kind: "create", path: "A.md" },
        { schemaVersion: 1, kind: "create", path: "A.md" }
      ],
      "2026-09-29T00:00:00.000Z"
    );
    expect(created).toMatchObject({ verifiedRenames: [], subjectPersistenceFailed: false });
    expect(database.repository.findNoteSubjectByPath("A.md")?.subjectId).toBe("subject-1");

    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "modify", path: "A.md" }],
      "2026-09-29T00:01:00.000Z"
    );
    expect(database.repository.findNoteSubjectByPath("A.md")?.subjectId).toBe("subject-1");
    database.close();
  });

  it("preserves the subject across an observed safe rename and records path history", async () => {
    const database = await openPluginDatabase({
      adapter: new MemoryBinaryStore(),
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });
    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "create", path: "A.md" }],
      "2026-09-29T00:00:00.000Z"
    );

    const batch = await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "rename", path: "B.md", oldPath: "A.md" }],
      "2026-09-29T00:02:00.000Z"
    );
    expect(batch.verifiedRenames).toEqual([
      { oldPath: "A.md", path: "B.md", subjectId: "subject-1" }
    ]);
    expect(database.repository.findNoteSubjectByPath("A.md")).toBeNull();
    expect(database.repository.findNoteSubjectByPath("B.md")?.subjectId).toBe("subject-1");
    expect(database.repository.listNotePathHistory("subject-1")).toEqual([
      {
        subjectId: "subject-1",
        path: "A.md",
        observedAt: "2026-09-29T00:00:00.000Z",
        retiredAt: "2026-09-29T00:02:00.000Z"
      },
      {
        subjectId: "subject-1",
        path: "B.md",
        observedAt: "2026-09-29T00:02:00.000Z",
        retiredAt: null
      }
    ]);
    database.close();
  });

  it("forks identity for an unobserved rename handled by synchronization", async () => {
    const database = await openPluginDatabase({
      adapter: new MemoryBinaryStore(),
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });
    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "create", path: "A.md" }],
      "2026-09-29T00:00:00.000Z"
    );

    const subjects = await database.synchronizeNoteSubjects(["B.md"], "2026-09-29T00:03:00.000Z");
    expect(subjects.get("B.md")).toBe("subject-2");
    expect(database.repository.findNoteSubjectByPath("A.md")).toBeNull();
    expect(database.repository.listNotePathHistory("subject-1")).toEqual([
      expect.objectContaining({ path: "A.md", retiredAt: "2026-09-29T00:03:00.000Z" })
    ]);
    database.close();
  });

  it("does not preserve a rename with an occupied destination or missing old binding", async () => {
    const database = await openPluginDatabase({
      adapter: new MemoryBinaryStore(),
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });
    await database.processVaultEvents(
      [
        { schemaVersion: 1, kind: "create", path: "A.md" },
        { schemaVersion: 1, kind: "create", path: "B.md" }
      ],
      "2026-09-29T00:00:00.000Z"
    );

    const occupied = await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "rename", path: "B.md", oldPath: "A.md" }],
      "2026-09-29T00:04:00.000Z"
    );
    expect(occupied.verifiedRenames).toEqual([]);
    expect(occupied.subjectPersistenceFailed).toBe(false);
    expect(database.repository.findNoteSubjectByPath("A.md")).toBeNull();
    expect(database.repository.findNoteSubjectByPath("B.md")).toBeNull();

    const rebound = await database.synchronizeNoteSubjects(["B.md"], "2026-09-29T00:05:00.000Z");
    expect(rebound.get("B.md")).toBe("subject-3");

    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "create", path: "E.md" }],
      "2026-09-29T00:05:30.000Z"
    );
    const missingSourceOccupied = await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "rename", path: "E.md", oldPath: "Gone.md" }],
      "2026-09-29T00:06:00.000Z"
    );
    expect(missingSourceOccupied.verifiedRenames).toEqual([]);
    expect(database.repository.findNoteSubjectByPath("E.md")).toBeNull();

    const missing = await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "rename", path: "C.md", oldPath: "Gone.md" }],
      "2026-09-29T00:07:00.000Z"
    );
    expect(missing.verifiedRenames).toEqual([]);
    expect(database.repository.findNoteSubjectByPath("C.md")).toBeNull();

    const noOldPath = await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "rename", path: "D.md" }],
      "2026-09-29T00:08:00.000Z"
    );
    expect(noOldPath.verifiedRenames).toEqual([]);

    const synced = await database.synchronizeNoteSubjects(
      ["B.md", "C.md", "D.md", "E.md"],
      "2026-09-29T00:09:00.000Z"
    );
    expect(synced.get("B.md")).toBe("subject-3");
    expect(synced.get("C.md")).toBe("subject-5");
    expect(synced.get("D.md")).toBe("subject-6");
    expect(synced.get("E.md")).toBe("subject-7");
    database.close();
  });

  it("retires on delete and assigns a fresh UUID when the path is created again", async () => {
    const database = await openPluginDatabase({
      adapter: new MemoryBinaryStore(),
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });
    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "create", path: "A.md" }],
      "2026-09-29T00:00:00.000Z"
    );
    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "delete", path: "A.md" }],
      "2026-09-29T00:06:00.000Z"
    );
    expect(database.repository.findNoteSubjectByPath("A.md")).toBeNull();

    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "create", path: "A.md" }],
      "2026-09-29T00:07:00.000Z"
    );
    expect(database.repository.findNoteSubjectByPath("A.md")?.subjectId).toBe("subject-2");
    database.close();
  });

  it("restores database state and flags failure when the rename flush fails", async () => {
    const store = new FailableBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });
    await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "create", path: "A.md" }],
      "2026-09-29T00:00:00.000Z"
    );

    store.failNextWrite = true;
    const batch = await database.processVaultEvents(
      [{ schemaVersion: 1, kind: "rename", path: "B.md", oldPath: "A.md" }],
      "2026-09-29T00:08:00.000Z"
    );
    expect(batch.subjectPersistenceFailed).toBe(true);
    expect(batch.verifiedRenames).toEqual([]);
    expect(database.repository.findNoteSubjectByPath("A.md")?.subjectId).toBe("subject-1");
    expect(database.repository.findNoteSubjectByPath("B.md")).toBeNull();
    expect(
      planIncrementalScan(batch.events, {
        maxEvents: 50,
        subjectPersistenceFailed: batch.subjectPersistenceFailed
      })
    ).toEqual({ mode: "full", reasons: ["subject-persistence-failed"] });

    const subjects = await database.synchronizeNoteSubjects(["B.md"], "2026-09-29T00:09:00.000Z");
    expect(subjects.get("B.md")).toBe("subject-2");
    expect(database.repository.findNoteSubjectByPath("A.md")).toBeNull();

    database.saveCompletedScan({
      id: "scan-after-restore",
      vaultFingerprint: "vault",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser",
      startedAt: "2026-09-29T00:09:30.000Z",
      finishedAt: "2026-09-29T00:09:31.000Z",
      files: [],
      parseProducts: [],
      findings: [],
      modelTraces: []
    });
    await database.flush();
    database.close();

    const reopened = await openPluginDatabase({
      adapter: store,
      databasePath: DATABASE_PATH,
      locateFile: LOCATE
    });
    expect(reopened.repository.listScanHistory(10)).toEqual([
      expect.objectContaining({ id: "scan-after-restore", status: "completed" })
    ]);
    reopened.close();
  });

  it("ignores events whose normalized paths are unsafe", async () => {
    const database = await openPluginDatabase({
      adapter: new MemoryBinaryStore(),
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });

    const batch = await database.processVaultEvents(
      [
        { schemaVersion: 1, kind: "create", path: "A//B.md" },
        { schemaVersion: 1, kind: "create", path: "A/./B.md" },
        { schemaVersion: 1, kind: "rename", path: "A//C.md", oldPath: "Old.md" }
      ],
      "2026-09-29T00:09:30.000Z"
    );
    expect(batch.subjectPersistenceFailed).toBe(false);
    expect(batch.verifiedRenames).toEqual([]);
    expect(database.repository.listActiveNoteSubjects()).toEqual([]);
    database.close();
  });

  it("retains subjects and path history across reopen", async () => {
    const store = new MemoryBinaryStore();
    const options = () => ({
      adapter: store,
      databasePath: DATABASE_PATH,
      locateFile: LOCATE,
      createSubjectId: deterministicSubjects()
    });
    const first = await openPluginDatabase(options());
    await first.processVaultEvents(
      [{ schemaVersion: 1, kind: "create", path: "A.md" }],
      "2026-09-29T00:00:00.000Z"
    );
    await first.processVaultEvents(
      [{ schemaVersion: 1, kind: "rename", path: "B.md", oldPath: "A.md" }],
      "2026-09-29T00:10:00.000Z"
    );
    await first.flush();
    first.close();

    const reopened = await openPluginDatabase(options());
    expect(reopened.repository.findNoteSubjectByPath("B.md")?.subjectId).toBe("subject-1");
    expect(reopened.repository.listNotePathHistory("subject-1")).toHaveLength(2);
    reopened.close();
  });
});
