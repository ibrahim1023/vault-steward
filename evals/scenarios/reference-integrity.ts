export const referenceIntegrityScenario = {
  name: "reference-integrity",
  deterministic: true,
  requiredMetrics: ["evidenceValidity", "precision", "recall"] as const
};
