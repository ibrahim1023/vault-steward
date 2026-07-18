import type {
  ModelComparisonReport,
  ModelComparisonRow,
  ModelComparisonSample
} from "./contracts.js";

/**
 * Summarizes already-redacted local evaluation samples. The result is descriptive
 * only: callers must not use it to select a default model or change scan behavior.
 */
export function summarizeModelComparisons(
  samples: readonly ModelComparisonSample[]
): ModelComparisonReport {
  const groups = new Map<string, ModelComparisonSample[]>();
  for (const sample of samples) {
    validateSample(sample);
    const key = [sample.agent, sample.family, sample.model, sample.hardware].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }

  return {
    schemaVersion: 1,
    comparisonOnly: true,
    rows: [...groups.values()]
      .map(summarizeGroup)
      .sort((left, right) =>
        [left.agent, left.family, left.model, left.hardware]
          .join("\u0000")
          .localeCompare([right.agent, right.family, right.model, right.hardware].join("\u0000"))
      )
  };
}

function summarizeGroup(samples: readonly ModelComparisonSample[]): ModelComparisonRow {
  const first = samples[0]!;
  const latency = samples.map((sample) => sample.replay.runtime.totalDurationMs);
  const caseResults = samples.flatMap((sample) => sample.replay.caseResults);
  return {
    agent: first.agent,
    family: first.family,
    model: first.model,
    hardware: first.hardware,
    sampleCount: samples.length,
    precision: averageMetric(samples, "precision"),
    recall: averageMetric(samples, "recall"),
    f1: averageMetric(samples, "f1"),
    evidenceValidity: averageMetric(samples, "evidenceSourceAccuracy"),
    p50LatencyMs: percentile(latency, 0.5),
    p95LatencyMs: percentile(latency, 0.95),
    peakMemoryBytes: Math.max(...samples.map((sample) => sample.replay.runtime.peakMemoryBytes)),
    retryCount: samples.reduce((total, sample) => total + sample.retryCount, 0),
    incompleteRate:
      caseResults.length === 0
        ? 0
        : caseResults.filter((result) => result.outcome === "incomplete").length / caseResults.length
  };
}

function averageMetric(
  samples: readonly ModelComparisonSample[],
  metric: "precision" | "recall" | "f1" | "evidenceSourceAccuracy"
): number | null {
  const values = samples
    .map((sample) => sample.replay.metrics[metric])
    .filter((value): value is number => typeof value === "number");
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: readonly number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * percentileValue) - 1]!;
}

function validateSample(sample: ModelComparisonSample): void {
  for (const value of [sample.agent, sample.family, sample.model, sample.hardware]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
      throw new Error("Model comparison metadata must be a bounded identifier.");
    }
  }
  if (!Number.isSafeInteger(sample.retryCount) || sample.retryCount < 0) {
    throw new Error("Model comparison retry counts must be non-negative integers.");
  }
}
