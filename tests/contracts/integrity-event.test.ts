import { describe, expect, it } from "vitest";

import {
  createEvidenceRevisionKey,
  createFindingIdentity,
  createFindingOccurrence
} from "../../src/contracts/finding-identity.js";
import {
  INTEGRITY_EVENT_KINDS,
  isIntegrityEventKind,
  parseIntegrityEvent,
  parseNewIntegrityEvent,
  type IntegrityEvent,
  type IntegrityEventCategory,
  type NewIntegrityEvent
} from "../../src/contracts/integrity-event.js";

const baseEvent: IntegrityEvent = {
  schemaVersion: 1,
  sequence: 1,
  id: "event-1",
  category: "audit",
  kind: "proposal-approved",
  occurredAt: "2026-09-28T12:00:00.000Z",
  scanId: "scan-1",
  proposalId: "proposal-1",
  approvalId: "approval-1",
  safeMetadata: { code: "approved", count: 1 }
};

const baseNewEvent: NewIntegrityEvent = {
  schemaVersion: 1,
  id: "event-1",
  category: "audit",
  kind: "proposal-approved",
  occurredAt: "2026-09-28T12:00:00.000Z",
  scanId: "scan-1",
  proposalId: "proposal-1",
  approvalId: "approval-1",
  safeMetadata: { code: "approved", count: 1 }
};

const allCategories = Object.keys(INTEGRITY_EVENT_KINDS) as IntegrityEventCategory[];

describe("integrity event contracts", () => {
  it("accepts every declared kind only under its category", () => {
    for (const category of allCategories) {
      for (const kind of INTEGRITY_EVENT_KINDS[category]) {
        const event = { ...baseEvent, category, kind, safeMetadata: { code: "ok" } };
        expect(parseIntegrityEvent(event)).toMatchObject({ ok: true });
        expect(isIntegrityEventKind(category, kind)).toBe(true);
      }
    }
  });

  it("rejects kinds under mismatched categories and unknown kinds", () => {
    const mismatches: Array<[IntegrityEventCategory, string]> = [
      ["audit", "finding-opened"],
      ["audit", "scan-started"],
      ["review", "proposal-approved"],
      ["review", "provider-ready"],
      ["operational", "disposition-snoozed"],
      ["operational", "apply-started"]
    ];
    for (const [category, kind] of mismatches) {
      expect(parseIntegrityEvent({ ...baseEvent, category, kind })).toMatchObject({
        ok: false
      });
      expect(isIntegrityEventKind(category, kind)).toBe(false);
    }

    expect(parseIntegrityEvent({ ...baseEvent, kind: "unknown-kind" })).toMatchObject({
      ok: false
    });
    expect(parseIntegrityEvent({ ...baseEvent, category: "diagnostic" })).toMatchObject({
      ok: false
    });
  });

  it("round-trips new and persisted events", () => {
    const parsedNew = parseNewIntegrityEvent(baseNewEvent);
    expect(parsedNew).toMatchObject({ ok: true });
    if (parsedNew.ok) {
      const persisted: IntegrityEvent = { ...parsedNew.value, sequence: 42 };
      expect(parseIntegrityEvent(persisted)).toEqual({ ok: true, value: persisted });
    }
    expect(parseIntegrityEvent(baseEvent)).toEqual({ ok: true, value: baseEvent });
  });

  it("rejects a sequence on new events and bad sequences on persisted events", () => {
    expect(parseNewIntegrityEvent({ ...baseNewEvent, sequence: 3 })).toMatchObject({
      ok: false
    });
    for (const sequence of [0, -1, 1.5, "3", Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseIntegrityEvent({ ...baseEvent, sequence })).toMatchObject({
        ok: false
      });
    }
  });

  it("requires round-trippable ISO timestamps", () => {
    for (const occurredAt of [
      "2026-09-28",
      "2026-09-28T12:00:00Z",
      "not a date",
      "2026-13-40T99:99:99.999Z",
      123
    ]) {
      expect(parseIntegrityEvent({ ...baseEvent, occurredAt })).toMatchObject({
        ok: false
      });
    }
    expect(
      parseIntegrityEvent({ ...baseEvent, occurredAt: "2026-09-28T23:59:59.999Z" })
    ).toMatchObject({ ok: true });
  });

  it("enforces metadata entry, size, and value bounds", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 33 }, (_, index) => [`k${index}`, "v"])
    );
    expect(parseIntegrityEvent({ ...baseEvent, safeMetadata: tooMany })).toMatchObject({
      ok: false
    });

    const oversized = Object.fromEntries(
      Array.from({ length: 17 }, (_, index) => [`k${index}`, "x".repeat(256)])
    );
    expect(parseIntegrityEvent({ ...baseEvent, safeMetadata: oversized })).toMatchObject({
      ok: false
    });

    for (const badValue of [
      { nested: { a: 1 } },
      { list: [1, 2] },
      { missing: undefined },
      { count: Number.NaN },
      { count: Number.POSITIVE_INFINITY },
      { longKey: "x", ["k".repeat(65)]: "v" },
      { code: "x".repeat(257) }
    ]) {
      expect(parseIntegrityEvent({ ...baseEvent, safeMetadata: badValue })).toMatchObject({
        ok: false
      });
    }
  });

  it("enforces the per-kind metadata allowlists", () => {
    expect(parseIntegrityEvent({ ...baseEvent, safeMetadata: { unknownKey: "v" } })).toMatchObject({
      ok: false
    });

    for (const [category, kind, key] of [
      ["audit", "proposal-approved", "provider"],
      ["audit", "apply-failed", "model"],
      ["review", "finding-opened", "durationMs"],
      ["review", "disposition-snoozed", "retryAfterSeconds"],
      ["operational", "scan-completed", "provider"],
      ["operational", "schedule-deferred", "count"],
      ["operational", "provider-rate-limited", "configVersion"]
    ] as const) {
      expect(
        parseIntegrityEvent({ ...baseEvent, category, kind, safeMetadata: { [key]: 1 } })
      ).toMatchObject({ ok: false });
    }

    for (const [kind, metadata] of [
      ["apply-failed", { code: "io", durationMs: 12, reason: "disk" }],
      ["disposition-snoozed", { code: "snoozed", count: 1, reason: "later" }],
      ["scan-incomplete", { configVersion: "v1", incomplete: true, durationMs: 5 }],
      ["schedule-deferred", { retryAfterSeconds: 30, reason: "rate" }],
      [
        "provider-rate-limited",
        { provider: "groq", model: "openai/gpt-oss-120b", retryCount: 1, resetAfterSeconds: 60 }
      ]
    ] as const) {
      const category = allCategories.find((candidate) =>
        (INTEGRITY_EVENT_KINDS[candidate] as readonly string[]).includes(kind)
      );
      expect(
        parseIntegrityEvent({ ...baseEvent, category, kind, safeMetadata: metadata })
      ).toMatchObject({ ok: true });
    }
  });

  it("rejects unsafe metadata strings and accepts provider/model identifiers", () => {
    const providerEvent = {
      ...baseEvent,
      category: "operational" as const,
      kind: "provider-ready" as const
    };
    for (const value of [
      "openai/gpt-oss-120b",
      "llama-3.3-70b-versatile",
      "qwen/qwen3-32b:latest"
    ]) {
      expect(
        parseIntegrityEvent({ ...providerEvent, safeMetadata: { model: value } })
      ).toMatchObject({ ok: true });
    }

    for (const value of [
      "https://api.example.com",
      "/absolute/path",
      "vault\\note.md",
      "..\\escape",
      "api-key abc",
      "bearer token",
      "secret value",
      "authorization: x",
      "prompt body",
      "line\nbreak"
    ]) {
      expect(
        parseIntegrityEvent({ ...providerEvent, safeMetadata: { model: value } })
      ).toMatchObject({ ok: false });
    }

    for (const value of [
      "Folder/Note.md",
      "Note.md",
      "has space",
      "UPPER",
      "a/b",
      "a:b",
      "https://api.example.com",
      "api-key abc",
      "line\nbreak"
    ]) {
      expect(parseIntegrityEvent({ ...baseEvent, safeMetadata: { reason: value } })).toMatchObject({
        ok: false
      });
    }
  });

  it("validates optional ID fields and required id", () => {
    for (const badId of ["", "x".repeat(257), "https://x", "has\nnewline", "/abs"]) {
      expect(parseIntegrityEvent({ ...baseEvent, id: badId })).toMatchObject({ ok: false });
      expect(parseIntegrityEvent({ ...baseEvent, scanId: badId })).toMatchObject({
        ok: false
      });
    }
    expect(parseIntegrityEvent({ ...baseEvent, id: undefined })).toMatchObject({
      ok: false
    });
  });

  it("enforces exact v1 identifier formats for typed references", () => {
    for (const badKey of ["finding:v1:not-a-hash", "finding:", "plain-key"]) {
      expect(parseIntegrityEvent({ ...baseEvent, stableKey: badKey })).toMatchObject({ ok: false });
    }
    for (const badId of ["occurrence:v1:not-a-hash", "occurrence:", "row-1"]) {
      expect(parseIntegrityEvent({ ...baseEvent, occurrenceId: badId })).toMatchObject({
        ok: false
      });
    }

    const identity = createFindingIdentity({
      identityVersion: 1,
      family: "task",
      subtype: "overdue",
      detectorId: "task-checker",
      detectorVersion: "1.0.0",
      subjectIds: ["subject-a"],
      semanticKey: "overdue-task:note-1"
    });
    const evidenceRevisionKey = createEvidenceRevisionKey([
      {
        role: "source",
        subjectId: "subject-a",
        locator: "note:body",
        sourceRevision: "rev-1"
      }
    ]);
    const occurrence = createFindingOccurrence({
      stableKey: identity.stableKey,
      scanId: "scan-1",
      evidenceRevisionKey,
      findingId: "finding-1"
    });

    expect(
      parseIntegrityEvent({
        ...baseEvent,
        stableKey: identity.stableKey,
        occurrenceId: occurrence.occurrenceId
      })
    ).toMatchObject({ ok: true });
  });

  it("never throws on malformed input", () => {
    const fuzz = [
      null,
      undefined,
      0,
      true,
      "event",
      [],
      {},
      { schemaVersion: "1" },
      { ...baseEvent, safeMetadata: "x" },
      { ...baseEvent, safeMetadata: null },
      { ...baseEvent, occurredAt: {} },
      { ...baseEvent, category: [] }
    ];
    for (const value of fuzz) {
      expect(() => parseIntegrityEvent(value)).not.toThrow();
      expect(() => parseNewIntegrityEvent(value)).not.toThrow();
      expect(parseIntegrityEvent(value)).toMatchObject({ ok: false });
    }
  });
});
