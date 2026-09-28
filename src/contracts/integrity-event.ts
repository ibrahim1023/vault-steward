import type { ContractParseResult } from "./finding-identity.js";

export const INTEGRITY_EVENT_KINDS = {
  audit: [
    "proposal-prepared",
    "proposal-approved",
    "proposal-dismissed",
    "proposal-deferred",
    "proposal-stale",
    "apply-started",
    "apply-succeeded",
    "apply-failed",
    "apply-rolled-back",
    "apply-recovery-required",
    "policy-save-approved"
  ],
  review: [
    "finding-opened",
    "finding-changed",
    "finding-recurred",
    "finding-resolved",
    "disposition-acknowledged",
    "disposition-ignored",
    "disposition-snoozed",
    "disposition-expected",
    "disposition-restored"
  ],
  operational: [
    "scan-started",
    "scan-completed",
    "scan-incomplete",
    "scan-canceled",
    "scan-failed",
    "schedule-triggered",
    "schedule-deferred",
    "provider-ready",
    "provider-unavailable",
    "provider-rate-limited"
  ]
} as const;

export type IntegrityEventCategory = keyof typeof INTEGRITY_EVENT_KINDS;
export type IntegrityEventKind = (typeof INTEGRITY_EVENT_KINDS)[IntegrityEventCategory][number];
export type SafeMetadataValue = string | number | boolean | null;

export type IntegrityEvent = {
  schemaVersion: 1;
  sequence: number;
  id: string;
  category: IntegrityEventCategory;
  kind: IntegrityEventKind;
  occurredAt: string;
  scanId?: string;
  stableKey?: string;
  occurrenceId?: string;
  proposalId?: string;
  approvalId?: string;
  safeMetadata: Record<string, SafeMetadataValue>;
};

export type NewIntegrityEvent = Omit<IntegrityEvent, "sequence">;

const GLOBAL_METADATA_KEYS = new Set([
  "code",
  "count",
  "durationMs",
  "formulaVersion",
  "configVersion",
  "provider",
  "model",
  "retryCount",
  "retryAfterSeconds",
  "resetAfterSeconds",
  "incomplete",
  "reason"
]);

const AUDIT_METADATA_KEYS = new Set(["code", "count", "durationMs", "reason"]);
const REVIEW_METADATA_KEYS = new Set(["code", "count", "reason"]);
const SCAN_METADATA_KEYS = new Set([
  "code",
  "count",
  "durationMs",
  "configVersion",
  "incomplete",
  "reason"
]);
const SCHEDULE_METADATA_KEYS = new Set(["code", "retryAfterSeconds", "reason"]);
const PROVIDER_METADATA_KEYS = new Set([
  "code",
  "provider",
  "model",
  "durationMs",
  "retryCount",
  "retryAfterSeconds",
  "resetAfterSeconds",
  "reason"
]);

const OPTIONAL_ID_FIELDS = [
  "scanId",
  "stableKey",
  "occurrenceId",
  "proposalId",
  "approvalId"
] as const;

const STABLE_KEY_PATTERN = /^finding:v1:[0-9a-f]{64}$/;
const OCCURRENCE_ID_PATTERN = /^occurrence:v1:[0-9a-f]{64}$/;

function metadataKeysForKind(kind: string): ReadonlySet<string> {
  if (
    kind.startsWith("proposal-") ||
    kind.startsWith("apply-") ||
    kind.startsWith("policy-save-")
  ) {
    return AUDIT_METADATA_KEYS;
  }
  if (kind.startsWith("finding-") || kind.startsWith("disposition-")) {
    return REVIEW_METADATA_KEYS;
  }
  if (kind.startsWith("scan-")) return SCAN_METADATA_KEYS;
  if (kind.startsWith("schedule-")) return SCHEDULE_METADATA_KEYS;
  if (kind.startsWith("provider-")) return PROVIDER_METADATA_KEYS;
  return new Set();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function isSafeIdString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 256 &&
    !hasControlCharacters(value) &&
    !/https?:\/\//i.test(value) &&
    !/(?:^|[\\/])\.{2}(?:[\\/]|$)/.test(value) &&
    !/^[\\/]/.test(value) &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !/(secret|api[-_]?key|authorization|bearer|prompt)/i.test(value)
  );
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function isSafeMetadataValue(key: string, value: unknown): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  if (value.length > 256) return false;
  if (key === "provider" || key === "model") {
    return (
      /^[A-Za-z0-9 ._:/-]+$/.test(value) &&
      !/https?:\/\//i.test(value) &&
      !/(?:^|[\\/])\.{2}(?:[\\/]|$)/.test(value) &&
      !/^[\\/]/.test(value) &&
      !/^[A-Za-z]:[\\/]/.test(value) &&
      !/(secret|api[-_]?key|authorization|bearer|prompt)/i.test(value)
    );
  }
  return /^[a-z0-9][a-z0-9._-]{0,255}$/.test(value);
}

function validateEvent(
  value: unknown,
  persisted: boolean
): ContractParseResult<IntegrityEvent | NewIntegrityEvent> {
  const diagnostics: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, diagnostics: ["integrity event must be an object"] };
  }

  const allowedFields = new Set([
    "schemaVersion",
    "id",
    "category",
    "kind",
    "occurredAt",
    "safeMetadata",
    ...OPTIONAL_ID_FIELDS,
    ...(persisted ? ["sequence"] : [])
  ]);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) diagnostics.push(`unknown field ${field}`);
  }

  if (value.schemaVersion !== 1) diagnostics.push("schemaVersion must be 1");
  if (persisted) {
    if (
      typeof value.sequence !== "number" ||
      !Number.isSafeInteger(value.sequence) ||
      value.sequence < 1
    ) {
      diagnostics.push("sequence must be a positive safe integer");
    }
  }
  if (!isSafeIdString(value.id)) diagnostics.push("id must be a safe 1..256 string");

  const category = value.category;
  const kind = value.kind;
  if (typeof category !== "string" || !Object.hasOwn(INTEGRITY_EVENT_KINDS, category)) {
    diagnostics.push("category must be audit, review, or operational");
  } else if (
    typeof kind !== "string" ||
    !(INTEGRITY_EVENT_KINDS[category as IntegrityEventCategory] as readonly string[]).includes(kind)
  ) {
    diagnostics.push("kind must be a declared kind for the category");
  }

  if (!isValidIsoTimestamp(value.occurredAt))
    diagnostics.push("occurredAt must be a round-trippable ISO timestamp");

  for (const field of OPTIONAL_ID_FIELDS) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && !isSafeIdString(fieldValue)) {
      diagnostics.push(`${field} must be a safe 1..256 string`);
      continue;
    }
    if (field === "stableKey" && fieldValue !== undefined && !STABLE_KEY_PATTERN.test(fieldValue)) {
      diagnostics.push("stableKey must use the finding:v1: identifier format");
    }
    if (
      field === "occurrenceId" &&
      fieldValue !== undefined &&
      !OCCURRENCE_ID_PATTERN.test(fieldValue)
    ) {
      diagnostics.push("occurrenceId must use the occurrence:v1: identifier format");
    }
  }

  if (!isRecord(value.safeMetadata)) {
    diagnostics.push("safeMetadata must be an object");
  } else {
    const entries = Object.entries(value.safeMetadata);
    if (entries.length > 32) diagnostics.push("safeMetadata allows at most 32 entries");
    const serialized = new TextEncoder().encode(JSON.stringify(value.safeMetadata)).length;
    if (serialized > 4096) diagnostics.push("safeMetadata exceeds 4096 serialized bytes");
    const allowedKeys = typeof kind === "string" ? metadataKeysForKind(kind) : new Set<string>();
    for (const [key, metadataValue] of entries) {
      if (
        key.length < 1 ||
        key.length > 64 ||
        !GLOBAL_METADATA_KEYS.has(key) ||
        !allowedKeys.has(key)
      ) {
        diagnostics.push(`metadata key ${key} is not allowed for this kind`);
        continue;
      }
      if (!isSafeMetadataValue(key, metadataValue)) {
        diagnostics.push(`metadata value for ${key} is not a safe value`);
      }
    }
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, value: value as unknown as IntegrityEvent };
}

export function parseIntegrityEvent(value: unknown): ContractParseResult<IntegrityEvent> {
  return validateEvent(value, true) as ContractParseResult<IntegrityEvent>;
}

export function parseNewIntegrityEvent(value: unknown): ContractParseResult<NewIntegrityEvent> {
  return validateEvent(value, false) as ContractParseResult<NewIntegrityEvent>;
}

export function isIntegrityEventKind(
  category: IntegrityEventCategory,
  kind: string
): kind is IntegrityEventKind {
  const kinds = INTEGRITY_EVENT_KINDS[category];
  return Array.isArray(kinds) && (kinds as readonly string[]).includes(kind);
}
