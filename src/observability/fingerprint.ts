import { createHash } from "node:crypto";

type FingerprintValue = string | number | boolean | null | FingerprintValue[] | FingerprintObject;
type FingerprintObject = { readonly [key: string]: FingerprintValue };

const FORBIDDEN_KEY = /prompt|output|excerpt|secret|content|body|absolute.?path/i;
const MAX_STRING_LENGTH = 256;

export function configurationFingerprint(input: FingerprintObject): string {
  const canonical = canonicalize(input);
  if (canonical === undefined) throw new Error("Configuration fingerprint input is invalid.");
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function canonicalize(value: unknown): FingerprintValue | undefined {
  if (typeof value === "string") return value.length <= MAX_STRING_LENGTH ? value : undefined;
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    if (value.length > 100) return undefined;
    const items: FingerprintValue[] = [];
    for (const item of value) {
      const canonical = canonicalize(item);
      if (canonical === undefined) return undefined;
      items.push(canonical);
    }
    return items;
  }
  if (value === null || typeof value !== "object") return undefined;
  const entries = Object.entries(value);
  if (entries.length > 100 || entries.some(([key]) => key.length > 80 || FORBIDDEN_KEY.test(key)))
    return undefined;
  const output: Record<string, FingerprintValue> = {};
  for (const [key, item] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    const canonical = canonicalize(item);
    if (canonical === undefined) return undefined;
    output[key] = canonical;
  }
  return output;
}
