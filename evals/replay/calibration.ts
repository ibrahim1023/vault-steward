export const CONFIDENCE_BUCKETS = ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"] as const;

export type ConfidenceBucket = (typeof CONFIDENCE_BUCKETS)[number];

export type ConfidenceCalibrationSample = {
  agent: string;
  findingType: string;
  confidence: number;
  correct: boolean;
  adjudicated: boolean;
};

export type ConfidenceCalibrationBucket = {
  agent: string;
  findingType: string;
  bucket: ConfidenceBucket;
  support: number;
  confidenceMean: number;
  accuracy: number;
  overconfidenceGap: number;
  underconfidenceGap: number;
  warning: boolean;
};

export type ConfidenceCalibrationReport = {
  schemaVersion: 1;
  minimumWarningSupport: number;
  warningGap: number;
  buckets: ConfidenceCalibrationBucket[];
};

const MINIMUM_WARNING_SUPPORT = 5;
const WARNING_GAP = 0.15;
const METADATA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * Calculates descriptive calibration from protected adjudicated labels. It has
 * no connection to finding severity, policies, proposals, approvals, or edits.
 */
export function calibrateConfidence(
  samples: readonly ConfidenceCalibrationSample[]
): ConfidenceCalibrationReport {
  const groups = new Map<string, ConfidenceCalibrationSample[]>();
  for (const sample of samples) {
    validateSample(sample);
    if (!sample.adjudicated) continue;
    const bucket = bucketFor(sample.confidence);
    const key = [sample.agent, sample.findingType, bucket].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }

  return {
    schemaVersion: 1,
    minimumWarningSupport: MINIMUM_WARNING_SUPPORT,
    warningGap: WARNING_GAP,
    buckets: [...groups.entries()]
      .map(([key, group]) => summarizeBucket(key, group))
      .sort((left, right) =>
        [left.agent, left.findingType, left.bucket]
          .join("\u0000")
          .localeCompare([right.agent, right.findingType, right.bucket].join("\u0000"))
      )
  };
}

function summarizeBucket(
  key: string,
  samples: readonly ConfidenceCalibrationSample[]
): ConfidenceCalibrationBucket {
  const [agent, findingType, bucket] = key.split("\u0000") as [string, string, ConfidenceBucket];
  const confidenceMean = average(samples.map((sample) => sample.confidence));
  const accuracy = average(samples.map((sample) => (sample.correct ? 1 : 0)));
  const gap = confidenceMean - accuracy;
  return {
    agent,
    findingType,
    bucket,
    support: samples.length,
    confidenceMean,
    accuracy,
    overconfidenceGap: Math.max(gap, 0),
    underconfidenceGap: Math.max(-gap, 0),
    warning: samples.length >= MINIMUM_WARNING_SUPPORT && Math.abs(gap) > WARNING_GAP
  };
}

function bucketFor(confidence: number): ConfidenceBucket {
  if (confidence < 0.2) return "0.0-0.2";
  if (confidence < 0.4) return "0.2-0.4";
  if (confidence < 0.6) return "0.4-0.6";
  if (confidence < 0.8) return "0.6-0.8";
  return "0.8-1.0";
}

function validateSample(sample: ConfidenceCalibrationSample): void {
  if (!METADATA_PATTERN.test(sample.agent) || !METADATA_PATTERN.test(sample.findingType)) {
    throw new Error("Calibration metadata must be bounded identifiers.");
  }
  if (!Number.isFinite(sample.confidence) || sample.confidence < 0 || sample.confidence > 1) {
    throw new Error("Calibration confidence must be between zero and one.");
  }
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
