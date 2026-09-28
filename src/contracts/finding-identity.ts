import { createHash } from "node:crypto";

import { FINDING_TYPES } from "./index.js";
import type { FindingType } from "./index.js";

export type FindingIdentity = {
  schemaVersion: 1;
  identityVersion: 1;
  stableKey: string;
  family: FindingType;
  subtype: string;
  detectorId: string;
  detectorVersion: string;
  policyId?: string;
  policyVersion?: string;
  subjectIds: readonly string[];
  semanticKey: string;
};

export type FindingIdentityInput = Omit<FindingIdentity, "stableKey" | "schemaVersion">;

export type FindingOccurrence = {
  schemaVersion: 1;
  occurrenceId: string;
  stableKey: string;
  scanId: string;
  evidenceRevisionKey: string;
  findingId: string;
};

export type EvidenceRevisionSubject = {
  role: string;
  subjectId: string;
  locator: string;
  sourceRevision: string;
};

export type ContractParseResult<T> =
  { ok: true; value: T } | { ok: false; diagnostics: readonly string[] };

const STABLE_KEY_PREFIX = "finding:v1:";
const OCCURRENCE_PREFIX = "occurrence:v1:";
const EVIDENCE_PREFIX = "evidence:v1:";

const STABLE_KEY_PATTERN = /^finding:v1:[0-9a-f]{64}$/;
const EVIDENCE_KEY_PATTERN = /^evidence:v1:[0-9a-f]{64}$/;
const OCCURRENCE_PATTERN = /^occurrence:v1:[0-9a-f]{64}$/;

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function isSafeCanonicalString(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    !hasControlCharacters(value) &&
    !/https?:\/\//i.test(value) &&
    !/(?:^|[\\/])\.{2}(?:[\\/]|$)/.test(value) &&
    !/^[\\/]/.test(value) &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !/(secret|api[-_]?key|authorization|bearer|prompt)/i.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateIdentityInput(input: FindingIdentityInput, fail: (message: string) => void): void {
  if (!isRecord(input)) {
    fail("finding identity input must be an object");
    return;
  }
  if (input.identityVersion !== 1) fail("identityVersion must be 1");
  if (!FINDING_TYPES.includes(input.family)) fail("family must be a supported finding type");
  if (!isSafeCanonicalString(input.subtype, 1, 128)) fail("subtype must be a safe 1..128 string");
  if (!isSafeCanonicalString(input.detectorId, 1, 128))
    fail("detectorId must be a safe 1..128 string");
  if (!isSafeCanonicalString(input.detectorVersion, 1, 128))
    fail("detectorVersion must be a safe 1..128 string");
  if (input.policyId !== undefined && !isSafeCanonicalString(input.policyId, 1, 128))
    fail("policyId must be a safe 1..128 string");
  if (input.policyVersion !== undefined && !isSafeCanonicalString(input.policyVersion, 1, 128))
    fail("policyVersion must be a safe 1..128 string");
  if (!Array.isArray(input.subjectIds)) {
    fail("subjectIds must be an array");
  } else {
    if (input.subjectIds.length < 1 || input.subjectIds.length > 16)
      fail("subjectIds must contain 1..16 entries");
    if (new Set(input.subjectIds).size !== input.subjectIds.length)
      fail("subjectIds must be unique");
    for (const subjectId of input.subjectIds) {
      if (!isSafeCanonicalString(subjectId, 1, 256))
        fail("each subjectId must be a safe 1..256 string");
    }
  }
  if (!isSafeCanonicalString(input.semanticKey, 1, 512))
    fail("semanticKey must be a safe 1..512 string");
}

export function createFindingIdentity(input: FindingIdentityInput): FindingIdentity {
  const problems: string[] = [];
  validateIdentityInput(input, (message) => problems.push(message));
  if (problems.length > 0) throw new Error("invalid finding identity input");

  const subjectIds = [...input.subjectIds].sort((a, b) => a.localeCompare(b));
  const payload = JSON.stringify([
    1,
    input.family,
    input.subtype,
    input.detectorId,
    input.detectorVersion,
    input.policyId ?? null,
    input.policyVersion ?? null,
    subjectIds,
    input.semanticKey
  ]);
  return {
    schemaVersion: 1,
    ...input,
    subjectIds,
    stableKey: `${STABLE_KEY_PREFIX}${sha256Hex(payload)}`
  };
}

function validateEvidenceSubjects(
  subjects: readonly EvidenceRevisionSubject[],
  fail: (message: string) => void
): void {
  if (!Array.isArray(subjects)) {
    fail("evidence subjects must be an array");
    return;
  }
  if (subjects.length < 1 || subjects.length > 16)
    fail("evidence subjects must contain 1..16 entries");
  for (const subject of subjects) {
    if (!isRecord(subject)) {
      fail("each evidence subject must be an object");
      continue;
    }
    if (!isSafeCanonicalString(subject.role, 1, 128))
      fail("each role must be a safe 1..128 string");
    if (!isSafeCanonicalString(subject.subjectId, 1, 256))
      fail("each subjectId must be a safe 1..256 string");
    if (!isSafeCanonicalString(subject.locator, 1, 256))
      fail("each locator must be a safe 1..256 string");
    if (!isSafeCanonicalString(subject.sourceRevision, 1, 256))
      fail("each sourceRevision must be a safe 1..256 string");
  }
}

export function createEvidenceRevisionKey(subjects: readonly EvidenceRevisionSubject[]): string {
  const problems: string[] = [];
  validateEvidenceSubjects(subjects, (message) => problems.push(message));
  if (problems.length > 0) throw new Error("invalid evidence revision subjects");

  const normalized = subjects
    .map((subject) => ({
      role: subject.role,
      subjectId: subject.subjectId,
      locator: subject.locator,
      sourceRevision: subject.sourceRevision
    }))
    .sort(
      (a, b) =>
        a.role.localeCompare(b.role) ||
        a.subjectId.localeCompare(b.subjectId) ||
        a.locator.localeCompare(b.locator) ||
        a.sourceRevision.localeCompare(b.sourceRevision)
    );
  const seen = new Set<string>();
  for (const subject of normalized) {
    const key = JSON.stringify(subject);
    if (seen.has(key)) throw new Error("duplicate evidence revision subject");
    seen.add(key);
  }
  return `${EVIDENCE_PREFIX}${sha256Hex(JSON.stringify(normalized))}`;
}

function validateOccurrenceInput(
  input: Omit<FindingOccurrence, "schemaVersion" | "occurrenceId">,
  fail: (message: string) => void
): void {
  if (!isRecord(input)) {
    fail("finding occurrence input must be an object");
    return;
  }
  if (!isSafeCanonicalString(input.stableKey, 1, 256) || !STABLE_KEY_PATTERN.test(input.stableKey))
    fail("stableKey must be a safe 1..256 string with the finding:v1: format");
  if (!isSafeCanonicalString(input.scanId, 1, 256)) fail("scanId must be a safe 1..256 string");
  if (
    !isSafeCanonicalString(input.evidenceRevisionKey, 1, 256) ||
    !EVIDENCE_KEY_PATTERN.test(input.evidenceRevisionKey)
  )
    fail("evidenceRevisionKey must be a safe 1..256 string with the evidence:v1: format");
  if (!isSafeCanonicalString(input.findingId, 1, 256))
    fail("findingId must be a safe 1..256 string");
}

export function createFindingOccurrence(
  input: Omit<FindingOccurrence, "schemaVersion" | "occurrenceId">
): FindingOccurrence {
  const problems: string[] = [];
  validateOccurrenceInput(input, (message) => problems.push(message));
  if (problems.length > 0) throw new Error("invalid finding occurrence input");

  const payload = JSON.stringify([input.stableKey, input.scanId, input.evidenceRevisionKey]);
  return {
    schemaVersion: 1,
    ...input,
    occurrenceId: `${OCCURRENCE_PREFIX}${sha256Hex(payload)}`
  };
}

export function parseFindingIdentity(value: unknown): ContractParseResult<FindingIdentity> {
  const diagnostics: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, diagnostics: ["finding identity must be an object"] };
  }
  if (value.schemaVersion !== 1) diagnostics.push("schemaVersion must be 1");

  const input: FindingIdentityInput = {
    identityVersion: value.identityVersion as 1,
    family: value.family as FindingType,
    subtype: value.subtype as string,
    detectorId: value.detectorId as string,
    detectorVersion: value.detectorVersion as string,
    ...(value.policyId !== undefined ? { policyId: value.policyId as string } : {}),
    ...(value.policyVersion !== undefined ? { policyVersion: value.policyVersion as string } : {}),
    subjectIds: value.subjectIds as string[],
    semanticKey: value.semanticKey as string
  };
  validateIdentityInput(input, (message) => diagnostics.push(message));
  if (!isSafeCanonicalString(value.stableKey, 1, 256))
    diagnostics.push("stableKey must be a safe 1..256 string");

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const identity = createFindingIdentity(input);
  if (value.stableKey !== identity.stableKey) {
    return { ok: false, diagnostics: ["stableKey does not match canonical identity"] };
  }
  return { ok: true, value: { ...identity } };
}

export function parseFindingOccurrence(value: unknown): ContractParseResult<FindingOccurrence> {
  const diagnostics: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, diagnostics: ["finding occurrence must be an object"] };
  }
  if (value.schemaVersion !== 1) diagnostics.push("schemaVersion must be 1");

  const input = {
    stableKey: value.stableKey as string,
    scanId: value.scanId as string,
    evidenceRevisionKey: value.evidenceRevisionKey as string,
    findingId: value.findingId as string
  };
  validateOccurrenceInput(input, (message) => diagnostics.push(message));
  if (
    !isSafeCanonicalString(value.occurrenceId, 1, 256) ||
    !OCCURRENCE_PATTERN.test(value.occurrenceId as string)
  )
    diagnostics.push("occurrenceId must be a safe 1..256 string with the occurrence:v1: format");

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const occurrence = createFindingOccurrence(input);
  if (value.occurrenceId !== occurrence.occurrenceId) {
    return { ok: false, diagnostics: ["occurrenceId does not match canonical occurrence"] };
  }
  return { ok: true, value: occurrence };
}
