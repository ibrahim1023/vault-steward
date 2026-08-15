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
  const matches = matchFindings(expected, actual);
  const truePositive = matches.length;
  const falsePositive = actual.length - truePositive;
  const falseNegative = expected.length - truePositive;
  const severityMatches = matches.filter(
    ({ expected, actual }) => expected.severity === actual.severity
  ).length;
  const safeFixMatches = matches.filter(
    ({ expected, actual }) => expected.safeFix === actual.safeFix
  ).length;
  return {
    precision: ratio(truePositive, actual.length),
    recall: ratio(truePositive, expected.length),
    f1: f1(ratio(truePositive, actual.length), ratio(truePositive, expected.length)),
    falsePositives: falsePositive,
    falseNegatives: falseNegative,
    evidenceSourceAccuracy: ratio(matches.length, actual.length),
    sourceRangeAccuracy: ratio(
      matches.filter(
        ({ expected, actual }) =>
          expected.notePath === actual.notePath && expected.locator === actual.locator
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

function findingMatches(expected: GradedFinding, actual: GradedFinding): boolean {
  return (
    expected.type === actual.type &&
    expected.notePath === actual.notePath &&
    expected.locator === actual.locator
  );
}

function matchFindings(
  expected: readonly GradedFinding[],
  actual: readonly GradedFinding[]
): Array<{ expected: GradedFinding; actual: GradedFinding }> {
  const remainingExpected = new Set(expected.keys());
  const matches: Array<{ expected: GradedFinding; actual: GradedFinding }> = [];
  for (const candidate of actual) {
    const matchIndex = [...remainingExpected].find((index) =>
      findingMatches(expected[index]!, candidate)
    );
    if (matchIndex === undefined) continue;
    remainingExpected.delete(matchIndex);
    matches.push({ expected: expected[matchIndex]!, actual: candidate });
  }
  return matches;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}
function f1(precision: number | null, recall: number | null): number | null {
  return precision === null || recall === null || precision + recall === 0
    ? null
    : (2 * precision * recall) / (precision + recall);
}
