import type { EvaluationReport } from "./contracts.js";

export type BaselineRationale = {
  author: string;
  date: string;
  affectedMetrics: string[];
  reviewReason: string;
};

export function compareEvaluationReports(
  baseline: EvaluationReport,
  candidate: EvaluationReport,
  rationale?: BaselineRationale
): string[] {
  if (baseline.provenance.fixtureManifestHash !== candidate.provenance.fixtureManifestHash)
    return ["fixture manifest changed"];
  const failures: string[] = [];
  if (candidate.cases.some((item) => item.outcome === "failed"))
    failures.push("critical case failed");
  const metrics = candidate.metrics;
  for (const key of [
    "evidenceValidity",
    "schemaValidity",
    "routingCompliance",
    "terminationCompliance"
  ] as const)
    if (metrics[key] !== undefined && metrics[key] !== 1) failures.push(`${key} is invalid`);
  if (metrics.unsupportedClaimRate !== undefined && metrics.unsupportedClaimRate !== 0)
    failures.push("unsupported claims increased");
  for (const [key, limit, label] of [
    ["precision", 0.02, "precision"],
    ["recall", 0.03, "recall"],
    ["f1", 0.02, "f1"]
  ] as const) {
    const before = baseline.metrics[key];
    const after = candidate.metrics[key];
    if (
      before !== null &&
      after !== null &&
      before - after > limit &&
      !validRationale(rationale, key)
    )
      failures.push(`${label} dropped`);
  }
  return failures;
}

function validRationale(value: BaselineRationale | undefined, metric: string): boolean {
  return (
    !!value &&
    value.author.length > 0 &&
    Number.isFinite(Date.parse(value.date)) &&
    value.reviewReason.length > 0 &&
    value.affectedMetrics.includes(metric)
  );
}
