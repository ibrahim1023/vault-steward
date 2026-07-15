export type PerformanceBaseline = {
  schemaVersion: 1;
  minimumFileCount: number;
  minimumAttachmentCount: number;
  maxFullScanMs: number;
  maxIncrementalScanMs: number;
  maxHeapDeltaBytes: number;
  maxSqliteWriteBytes: number;
};

export type PerformanceMeasurement = {
  fileCount: number;
  attachmentCount: number;
  fullScanMs: number;
  incrementalScanMs: number;
  heapDeltaBytes: number;
  sqliteWriteBytes: number;
};

export function evaluatePerformanceBudget(
  baseline: PerformanceBaseline,
  measurement: PerformanceMeasurement
): string[] {
  const errors: string[] = [];
  if (measurement.fileCount < baseline.minimumFileCount)
    errors.push("fixture file count is below baseline");
  if (measurement.attachmentCount < baseline.minimumAttachmentCount)
    errors.push("fixture attachment count is below baseline");
  if (measurement.fullScanMs > baseline.maxFullScanMs)
    errors.push("full scan duration exceeded baseline");
  if (measurement.incrementalScanMs > baseline.maxIncrementalScanMs)
    errors.push("incremental scan duration exceeded baseline");
  if (measurement.heapDeltaBytes > baseline.maxHeapDeltaBytes)
    errors.push("heap growth exceeded baseline");
  if (measurement.sqliteWriteBytes > baseline.maxSqliteWriteBytes)
    errors.push("SQLite write size exceeded baseline");
  return errors;
}
