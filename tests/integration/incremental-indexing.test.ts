import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

describe("incremental parse-product reuse", () => {
  it("reuses only records with an exact path, revision, and parser version", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "now",
      finishedAt: "later",
      status: "completed",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser-1"
    });
    repository.saveParseProducts("scan-1", "parser-1", [
      {
        path: "A.md",
        revisionHash: "a1",
        frontmatterHash: "f1",
        bodyMetadataHash: "b1",
        dependencies: [{ targetPath: "B", relation: "wiki" }]
      }
    ]);

    expect(
      repository.getReusableParseProducts({
        parserVersion: "parser-1",
        files: [
          { path: "A.md", revisionHash: "a1" },
          { path: "B.md", revisionHash: "b1" }
        ]
      })
    ).toEqual([
      {
        path: "A.md",
        revisionHash: "a1",
        frontmatterHash: "f1",
        bodyMetadataHash: "b1",
        dependencies: [{ targetPath: "B", relation: "wiki" }]
      }
    ]);
    expect(
      repository.getReusableParseProducts({
        parserVersion: "parser-2",
        files: [{ path: "A.md", revisionHash: "a1" }]
      })
    ).toEqual([]);
  });

  it("deduplicates repeated dependency edges from one source note", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan-duplicate-dependency",
      vaultFingerprint: "vault",
      startedAt: "now",
      finishedAt: "later",
      status: "completed",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser-1"
    });

    repository.saveParseProducts("scan-duplicate-dependency", "parser-1", [
      {
        path: "Home.md",
        revisionHash: "r1",
        frontmatterHash: "frontmatter",
        bodyMetadataHash: "metadata",
        dependencies: [
          { targetPath: "Target", relation: "wiki" },
          { targetPath: "Target", relation: "wiki" }
        ]
      }
    ]);

    expect(
      repository.getReusableParseProducts({
        parserVersion: "parser-1",
        files: [{ path: "Home.md", revisionHash: "r1" }]
      })[0]?.dependencies
    ).toEqual([{ targetPath: "Target", relation: "wiki" }]);
  });
});
