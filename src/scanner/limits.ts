export type ScanLimits = {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxHeadingsPerFile: number;
  maxReferencesPerFile: number;
};

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
  maxFiles: 10_000,
  maxFileBytes: 2 * 1_024 * 1_024,
  maxTotalBytes: 50 * 1_024 * 1_024,
  maxHeadingsPerFile: 5_000,
  maxReferencesPerFile: 10_000
};

export function assertScanLimits(files: readonly { content: string }[], limits: ScanLimits): void {
  if (files.length > limits.maxFiles) throw new Error("vault exceeds configured processing limits");
  let totalBytes = 0;
  for (const file of files) {
    const bytes = new TextEncoder().encode(file.content).byteLength;
    if (bytes > limits.maxFileBytes) throw new Error("vault exceeds configured processing limits");
    totalBytes += bytes;
    if (totalBytes > limits.maxTotalBytes)
      throw new Error("vault exceeds configured processing limits");
  }
}
