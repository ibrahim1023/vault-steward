export type PolicyCoverageDefinition = {
  policyId: string;
  version: string;
  valid: boolean;
  deprecated: boolean;
};

export type PolicyCoverageExecution = {
  policyId: string;
  version: string;
  violationCount: number;
};

export type PolicyCoverageFixture = {
  policyId: string;
  version: string;
};

export type PolicyCoverageReview = {
  policyId: string;
  version: string;
  falsePositiveCount: number;
  totalCount: number;
};

export type PolicyCoverageStatus =
  "covered" | "unexercised" | "missing-fixture" | "review-needed" | "deprecated";

export type PolicyCoverageSuggestion =
  "none" | "add-fixture" | "review-false-positives" | "remove-deprecated";

export type PolicyCoverageRow = {
  policyId: string;
  version: string;
  defined: boolean;
  executedCount: number;
  triggeredCount: number;
  fixtureCoverage: boolean;
  reviewerFalsePositiveRate: number | null;
  deprecated: boolean;
  status: PolicyCoverageStatus;
  suggestion: PolicyCoverageSuggestion;
};

export type PolicyCoverageInput = {
  definitions: PolicyCoverageDefinition[];
  executions: PolicyCoverageExecution[];
  fixtures: PolicyCoverageFixture[];
  reviews: PolicyCoverageReview[];
};

export type PolicyCoverageReport = {
  schemaVersion: 1;
  rows: PolicyCoverageRow[];
};
