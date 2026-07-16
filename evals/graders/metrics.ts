export type GradedFinding = {
  type: string;
  notePath: string;
  locator: string;
  severity: string;
  safeFix: "applicable" | "not-applicable";
  supported: boolean;
  schemaValid: boolean;
  routeValid: boolean;
  terminated: boolean;
};

export function gradeExpectedFindings(
  expected: readonly GradedFinding[],
  actual: readonly GradedFinding[]
) {
  const expectedKeys = new Set(expected.map(key));
  const actualKeys = new Set(actual.map(key));
  const matches = actual.filter((finding) => expectedKeys.has(key(finding)));
  const truePositive = matches.length;
  const falsePositive = actual.length - truePositive;
  const falseNegative = expected.length - truePositive;
  const severityMatches = matches.filter(
    (finding) => expected.find((item) => key(item) === key(finding))?.severity === finding.severity
  ).length;
  const safeFixMatches = matches.filter(
    (finding) => expected.find((item) => key(item) === key(finding))?.safeFix === finding.safeFix
  ).length;
  return {
    precision: ratio(truePositive, actual.length),
    recall: ratio(truePositive, expected.length),
    f1: f1(ratio(truePositive, actual.length), ratio(truePositive, expected.length)),
    falsePositives: falsePositive,
    falseNegatives: falseNegative,
    evidenceSourceAccuracy: ratio(matches.length, actual.length),
    sourceRangeAccuracy: ratio(
      matches.filter((finding) =>
        expected.some(
          (item) => item.notePath === finding.notePath && item.locator === finding.locator
        )
      ).length,
      actual.length
    ),
    severityAgreement: ratio(severityMatches, matches.length),
    suggestedFixValidity: ratio(safeFixMatches, matches.length),
    unsupportedClaimRate: ratio(
      actual.filter((finding) => !finding.supported).length,
      actual.length
    ),
    schemaValidity: ratio(actual.filter((finding) => finding.schemaValid).length, actual.length),
    routingCompliance: ratio(actual.filter((finding) => finding.routeValid).length, actual.length),
    terminationCompliance: ratio(
      actual.filter((finding) => finding.terminated).length,
      actual.length
    )
  };
}

function key(finding: Pick<GradedFinding, "type" | "notePath" | "locator">): string {
  return `${finding.type}:${finding.notePath}:${finding.locator}`;
}
function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}
function f1(precision: number | null, recall: number | null): number | null {
  return precision === null || recall === null || precision + recall === 0
    ? null
    : (2 * precision * recall) / (precision + recall);
}
