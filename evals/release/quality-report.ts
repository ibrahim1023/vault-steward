import type { EvaluationReport } from "../contracts.js";
import type { ConfidenceCalibrationReport } from "../replay/calibration.js";
import type { ReleaseProviderReport } from "./contracts.js";

export type ReleaseQualityReport = {
  schemaVersion: 1;
  generatedAt: string;
  decision: "go" | "no-go";
  gates: Array<{ name: string; status: "passed" | "pending" | "failed" }>;
  evaluation: { available: boolean; precision: number | null; recall: number | null; f1: number | null };
  providers: Array<{ provider: "ollama" | "openai"; status: "passed" | "pending" | "failed" }>;
  calibration: { available: boolean; warningCount: number };
  privacy: { localByDefault: true; automaticPublishing: false; rawVaultContentIncluded: false };
  limitations: string[];
};

export function buildReleaseQualityReport(input: {
  generatedAt: string;
  evaluation?: EvaluationReport;
  providerReports: readonly ReleaseProviderReport[];
  calibration?: ConfidenceCalibrationReport;
  manualAcceptance: boolean;
}): ReleaseQualityReport {
  const providers = (["ollama", "openai"] as const).map((provider) => {
    const report = input.providerReports.find((item) => item.provider === provider);
    return {
      provider,
      status: !report ? ("pending" as const) : report.status === "passed" ? ("passed" as const) : ("failed" as const)
    };
  });
  const evaluationPassed = Boolean(input.evaluation && input.evaluation.cases.every((item) => item.outcome === "passed"));
  const providerPassed = providers.every((item) => item.status === "passed");
  const ollamaStatus = providers.find((item) => item.provider === "ollama")?.status ?? "pending";
  const openAiStatus = providers.find((item) => item.provider === "openai")?.status ?? "pending";
  const gates: ReleaseQualityReport["gates"] = [
    { name: "evaluation", status: !input.evaluation ? "pending" : evaluationPassed ? "passed" : "failed" },
    { name: "ollama-provider", status: ollamaStatus },
    { name: "openai-provider", status: openAiStatus },
    { name: "manual-obsidian-acceptance", status: input.manualAcceptance ? "passed" : "pending" },
    { name: "privacy-local-default", status: "passed" }
  ];
  const decision = evaluationPassed && providerPassed && input.manualAcceptance ? "go" : "no-go";
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    decision,
    gates,
    evaluation: {
      available: Boolean(input.evaluation),
      precision: input.evaluation?.metrics.precision ?? null,
      recall: input.evaluation?.metrics.recall ?? null,
      f1: input.evaluation?.metrics.f1 ?? null
    },
    providers,
    calibration: {
      available: Boolean(input.calibration),
      warningCount: input.calibration?.buckets.filter((bucket) => bucket.warning).length ?? 0
    },
    privacy: { localByDefault: true, automaticPublishing: false, rawVaultContentIncluded: false },
    limitations: [
      "Manual Obsidian acceptance is required before release.",
      "Provider reports describe only their recorded fixture and configuration conditions.",
      "No report authorizes automatic vault edits."
    ]
  };
}
