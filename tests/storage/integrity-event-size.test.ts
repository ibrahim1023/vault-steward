import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import type { NewIntegrityEvent } from "../../src/contracts/integrity-event.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

const EVENT_COUNT = 10_000;
const SIZE_BUDGET_BYTES = 8 * 1024 * 1024;

const KINDS: ReadonlyArray<Pick<NewIntegrityEvent, "category" | "kind">> = [
  { category: "audit", kind: "proposal-prepared" },
  { category: "audit", kind: "apply-succeeded" },
  { category: "review", kind: "finding-opened" },
  { category: "review", kind: "finding-resolved" },
  { category: "operational", kind: "scan-started" },
  { category: "operational", kind: "provider-ready" }
];

describe("integrity event size budget", () => {
  it("retains 10,000 mixed events without a cap within the SQLite fixture budget", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);

    repository.withTransaction(() => {
      for (let index = 0; index < EVENT_COUNT; index += 1) {
        const { category, kind } = KINDS[index % KINDS.length]!;
        repository.appendIntegrityEvent({
          schemaVersion: 1,
          id: `event-${index}`,
          category,
          kind,
          occurredAt: "2026-09-29T00:00:00.000Z",
          safeMetadata: {}
        });
      }
    });

    expect(repository.listIntegrityEvents()).toHaveLength(EVENT_COUNT);
    expect(database.export().byteLength).toBeLessThanOrEqual(SIZE_BUDGET_BYTES);
  });
});
