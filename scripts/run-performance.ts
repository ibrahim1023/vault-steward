import initSqlJs from "sql.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { evaluatePerformanceBudget, type PerformanceBaseline } from "../src/performance/budget.js";
import { scanVaultFiles } from "../src/scanner/scan.js";
import { applyMigrations } from "../src/storage/migrations.js";
import { VaultStewardRepository } from "../src/storage/repositories.js";
import type { VaultFile } from "../src/vault-adapter/types.js";

const root = resolve(import.meta.dirname, "..");
const baseline = JSON.parse(
  await readFile(resolve(root, "evals/baselines/performance.json"), "utf8")
) as PerformanceBaseline;
const files = createFixture();
const heapBefore = process.memoryUsage().heapUsed;
const fullStarted = performance.now();
const snapshot = scanVaultFiles(files);
const fullScanMs = performance.now() - fullStarted;
const incrementalStarted = performance.now();
scanVaultFiles([files[0]!]);
const incrementalScanMs = performance.now() - incrementalStarted;
const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);

const sql = await initSqlJs({
  locateFile: (file) => resolve(root, "node_modules/sql.js/dist", file)
});
const database = new sql.Database();
applyMigrations(database);
const repository = new VaultStewardRepository(database);
repository.saveScan({
  id: snapshot.id,
  vaultFingerprint: "performance-fixture",
  startedAt: "2026-07-13T00:00:00Z",
  finishedAt: "2026-07-13T00:00:01Z",
  status: "completed",
  configHash: "performance",
  inputHash: "performance",
  parserVersion: "1"
});
for (const note of snapshot.notes) {
  repository.saveNote({
    id: `${snapshot.id}:${note.path}`,
    scanId: snapshot.id,
    path: note.path,
    revisionHash: note.revision,
    frontmatterJson: "{}",
    bodyMetadataJson: "{}"
  });
}
const sqliteWriteBytes = database.export().byteLength;
database.close();

const measurement = {
  fileCount: files.length,
  attachmentCount: files.filter((file) => file.path.startsWith("attachments/")).length,
  fullScanMs,
  incrementalScanMs,
  heapDeltaBytes,
  sqliteWriteBytes
};
const errors = evaluatePerformanceBudget(baseline, measurement);
await mkdir(resolve(root, "evals/reports"), { recursive: true });
await writeFile(
  resolve(root, "evals/reports/performance.json"),
  `${JSON.stringify({ suite: "performance", baseline, measurement, errors }, null, 2)}\n`
);
if (errors.length) throw new Error(`Performance baseline failed: ${errors.join("; ")}`);
console.log(JSON.stringify({ suite: "performance", ...measurement }));

function createFixture(): VaultFile[] {
  const notes = Array.from({ length: 250 }, (_, index) => ({
    path: `Notes/Note-${String(index).padStart(3, "0")}.md`,
    revision: `r-${index}`,
    content: `# Note ${index}\n[[Notes/Note-${String((index + 1) % 250).padStart(3, "0")}]]\n`
  }));
  const attachments = Array.from({ length: 50 }, (_, index) => ({
    path: `attachments/file-${index}.pdf`,
    revision: `a-${index}`,
    content: "attachment"
  }));
  return [...notes, ...attachments];
}
