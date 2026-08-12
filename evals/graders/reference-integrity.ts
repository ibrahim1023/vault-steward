export type ExpectedReferenceFinding = {
  type: "broken-reference" | "invalid-reference";
  notePath: string;
  locator: string;
};

export type ReferenceIntegrityCase = {
  id: string;
  expected: ExpectedReferenceFinding[];
};

export type ReferenceIntegrityResult = {
  id: string;
  actual: ExpectedReferenceFinding[];
};

export type ReferenceIntegrityReport = {
  evidenceValidity: number;
  precision: number;
  recall: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
};

export function gradeReferenceIntegrity(
  cases: readonly ReferenceIntegrityCase[],
  results: readonly ReferenceIntegrityResult[]
): ReferenceIntegrityReport {
  let expectedTotal = 0;
  let actualTotal = 0;
  let matched = 0;

  for (const testCase of cases) {
    const actual = results.find((result) => result.id === testCase.id)?.actual ?? [];
    expectedTotal += testCase.expected.length;
    actualTotal += actual.length;
    const remainingExpected = new Set(testCase.expected.keys());
    for (const finding of actual) {
      const matchIndex = [...remainingExpected].find((index) => {
        const expected = testCase.expected[index]!;
        return (
          expected.type === finding.type &&
          expected.notePath === finding.notePath &&
          expected.locator === finding.locator
        );
      });
      if (matchIndex !== undefined) {
        remainingExpected.delete(matchIndex);
        matched += 1;
      }
    }
  }

  return {
    evidenceValidity: actualTotal === 0 && expectedTotal > 0 ? 0 : matched / actualTotal,
    precision: actualTotal === 0 ? 0 : matched / actualTotal,
    recall: expectedTotal === 0 ? 1 : matched / expectedTotal,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0
  };
}
