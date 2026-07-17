import type { EvaluationCase, EvaluationReport, EvaluationSplit } from "./contracts.js";

export type EvaluationSelection = {
  suite?: string;
  agent?: string;
  caseIds?: string[];
  splits: EvaluationSplit[];
  modelProfile?: string;
  manifest?: string;
  compare?: string;
  replay?: boolean;
};

export function parseEvaluationSelection(args: readonly string[]): EvaluationSelection {
  const selection: EvaluationSelection = { splits: [] };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!flag?.startsWith("--")) throw new Error("Evaluation argument is invalid.");
    if (flag === "--replay") {
      selection.replay = true;
      selection.suite = "replay";
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}.`);
    index++;
    if (flag === "--suite") selection.suite = value;
    else if (flag === "--agent") selection.agent = value;
    else if (flag === "--case") selection.caseIds = [...(selection.caseIds ?? []), value];
    else if (flag === "--split") {
      if (!isSplit(value)) throw new Error("Unknown evaluation split.");
      selection.splits.push(value);
    } else if (flag === "--model-profile") selection.modelProfile = value;
    else if (flag === "--manifest") selection.manifest = value;
    else if (flag === "--compare") selection.compare = value;
    else throw new Error("Unknown evaluation argument.");
  }
  if (selection.replay && !selection.manifest)
    throw new Error("Replay evaluation requires an explicit manifest.");
  if (selection.splits.length === 0) selection.splits = ["development", "ci-regression"];
  return selection;
}

export function selectEvaluationCases(
  cases: readonly EvaluationCase[],
  selection: EvaluationSelection
): EvaluationCase[] {
  const selected = cases.filter(
    (item) =>
      selection.splits.includes(item.split) &&
      (!selection.agent || item.agent === selection.agent) &&
      (!selection.caseIds || selection.caseIds.includes(item.id))
  );
  if (selection.caseIds && selected.length !== selection.caseIds.length)
    throw new Error("Unknown evaluation case.");
  if (
    selected.some(
      (item) =>
        (item.split === "held-out" || item.split === "human-review") &&
        !selection.splits.includes(item.split)
    )
  )
    throw new Error("Held-out evaluation requires an explicit split.");
  if (selected.length === 0) throw new Error("Evaluation selection is empty.");
  return selected;
}

export function buildRedactedReport(
  input: Omit<EvaluationReport, "schemaVersion" | "reportId" | "createdAt"> & {
    reportId: string;
    createdAt: string;
  }
): EvaluationReport {
  return { schemaVersion: 1, ...input };
}

function isSplit(value: string): value is EvaluationSplit {
  return ["development", "ci-regression", "held-out", "adversarial", "human-review"].includes(
    value
  );
}
