import type {
  PolicyCoverageInput,
  PolicyCoverageReport,
  PolicyCoverageRow,
  PolicyCoverageStatus
} from "./contracts.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REVIEW_NEEDED_RATE = 0.2;

export function summarizePolicyCoverage(input: PolicyCoverageInput): PolicyCoverageReport {
  validateDefinitions(input);
  const definitions = new Map(
    input.definitions.map((definition) => [
      keyFor(definition.policyId, definition.version),
      definition
    ])
  );
  validateReferences(input, definitions);

  return {
    schemaVersion: 1,
    rows: input.definitions
      .map((definition) => summarizeDefinition(definition, input))
      .sort((left, right) =>
        keyFor(left.policyId, left.version).localeCompare(keyFor(right.policyId, right.version))
      )
  };
}

function summarizeDefinition(
  definition: PolicyCoverageInput["definitions"][number],
  input: PolicyCoverageInput
): PolicyCoverageRow {
  const matching = <T extends { policyId: string; version: string }>(items: readonly T[]): T[] =>
    items.filter(
      (item) => item.policyId === definition.policyId && item.version === definition.version
    );
  const executions = matching(input.executions);
  const fixtures = matching(input.fixtures);
  const reviews = matching(input.reviews);
  const totalReviews = reviews.reduce((total, review) => total + review.totalCount, 0);
  const falsePositives = reviews.reduce((total, review) => total + review.falsePositiveCount, 0);
  const reviewerFalsePositiveRate = totalReviews === 0 ? null : falsePositives / totalReviews;
  const status = statusFor({
    deprecated: definition.deprecated,
    executedCount: executions.length,
    fixtureCoverage: fixtures.length > 0,
    reviewerFalsePositiveRate
  });
  return {
    policyId: definition.policyId,
    version: definition.version,
    defined: definition.valid,
    executedCount: executions.length,
    triggeredCount: executions.reduce((total, execution) => total + execution.violationCount, 0),
    fixtureCoverage: fixtures.length > 0,
    reviewerFalsePositiveRate,
    deprecated: definition.deprecated,
    status,
    suggestion: suggestionFor(status)
  };
}

function statusFor(input: {
  deprecated: boolean;
  executedCount: number;
  fixtureCoverage: boolean;
  reviewerFalsePositiveRate: number | null;
}): PolicyCoverageStatus {
  if (input.deprecated) return "deprecated";
  if (input.executedCount === 0) return "unexercised";
  if (!input.fixtureCoverage) return "missing-fixture";
  if (
    input.reviewerFalsePositiveRate !== null &&
    input.reviewerFalsePositiveRate >= REVIEW_NEEDED_RATE
  ) {
    return "review-needed";
  }
  return "covered";
}

function suggestionFor(status: PolicyCoverageStatus): PolicyCoverageRow["suggestion"] {
  switch (status) {
    case "deprecated":
      return "remove-deprecated";
    case "unexercised":
    case "missing-fixture":
      return "add-fixture";
    case "review-needed":
      return "review-false-positives";
    case "covered":
      return "none";
  }
}

function validateDefinitions(input: PolicyCoverageInput): void {
  const known = new Set<string>();
  for (const definition of input.definitions) {
    const key = keyFor(definition.policyId, definition.version);
    if (
      !IDENTIFIER.test(definition.policyId) ||
      !IDENTIFIER.test(definition.version) ||
      known.has(key)
    ) {
      throw new Error("Policy definitions must have unique bounded identifiers.");
    }
    known.add(key);
  }
}

function validateReferences(
  input: PolicyCoverageInput,
  definitions: ReadonlyMap<string, PolicyCoverageInput["definitions"][number]>
): void {
  const validateReference = (policyId: string, version: string): void => {
    if (!IDENTIFIER.test(policyId) || !IDENTIFIER.test(version)) {
      throw new Error("Policy coverage identifiers must be bounded.");
    }
    if (!definitions.has(keyFor(policyId, version))) {
      throw new Error("Policy coverage references an unknown policy version.");
    }
  };
  for (const execution of input.executions) {
    validateReference(execution.policyId, execution.version);
    validateNonNegative("violationCount", execution.violationCount);
  }
  for (const fixture of input.fixtures) validateReference(fixture.policyId, fixture.version);
  for (const review of input.reviews) {
    validateReference(review.policyId, review.version);
    validateNonNegative("falsePositiveCount", review.falsePositiveCount);
    validateNonNegative("totalCount", review.totalCount);
    if (review.totalCount === 0 || review.falsePositiveCount > review.totalCount) {
      throw new Error("falsePositiveCount must not exceed a positive totalCount.");
    }
  }
}

function validateNonNegative(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}

function keyFor(policyId: string, version: string): string {
  return `${policyId}\u0000${version}`;
}
