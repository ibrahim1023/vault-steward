# Local Trace Inspector and Agent Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every governed scan and persisted finding inspectable through a compact, local-only trace timeline, lineage inspector, configuration fingerprint, retention controls, and operational metrics.

**Architecture:** Extend the Phase 12 trace schema with typed read models and a migration for configuration/snapshot metadata. The scan persistence facade records bounded child spans and a canonical configuration fingerprint; repository query methods return content-free projections. The existing workspace receives a collapsed Observability view, while Obsidian settings own user-controlled retention and optional snapshot preferences.

**Tech Stack:** TypeScript, React 19, sql.js SQLite, Obsidian Plugin API, Vitest, Testing Library.

## Global Constraints

- SQLite remains the canonical local store; no external telemetry, account, cloud store, or new database.
- Never persist note bodies, excerpts, raw prompts, raw model output, absolute paths, URLs, or secrets in trace data.
- Optional snapshot controls default to disabled; invalid content, traversal paths, and oversize records are rejected.
- Core modules cannot import Obsidian APIs; React consumes typed facade results only.
- Keep normal review and repair controls separate from the collapsed observability surface.
- Each task begins with a failing deterministic test and ends with a focused commit.

---

### Task 1: Trace Contracts and Configuration Fingerprint

**Files:**
- Modify: `src/contracts/trace.ts`
- Create: `src/observability/fingerprint.ts`
- Test: `tests/contracts/trace.test.ts`
- Create: `tests/observability/fingerprint.test.ts`

**Interfaces:**
- Produces `TraceKind`, `TraceTimelineEntry`, `FindingLineageView`, `TracePreferences`, `validateTracePreferences`, and `configurationFingerprint(input)`.
- Consumed by repository persistence, plugin database facade, and observability React view.

- [ ] **Step 1: Write failing contract/fingerprint tests**

```ts
expect(configurationFingerprint({ model: "a", policy: "v1" })).toBe(
  configurationFingerprint({ policy: "v1", model: "a" })
);
expect(configurationFingerprint({ model: "a" })).not.toBe(
  configurationFingerprint({ model: "b" })
);
expect(validateTracePreferences({ retentionDays: 30, storePromptSnapshots: false })).toBe(true);
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/contracts/trace.test.ts tests/observability/fingerprint.test.ts`

- [ ] **Step 3: Implement canonical hashing and bounded trace contracts**

```ts
export function configurationFingerprint(input: ConfigurationFingerprintInput): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}
```

Reject non-finite numbers, unbounded strings, and forbidden metadata before hashing.

- [ ] **Step 4: Re-run focused tests and commit**

Run: `npx vitest run tests/contracts/trace.test.ts tests/observability/fingerprint.test.ts`

Commit: `git commit -m "feat: add observability trace contracts"`

### Task 2: SQLite Trace Read Models, Preferences, and Inventory

**Files:**
- Modify: `src/storage/migrations.ts`
- Modify: `src/storage/repositories.ts`
- Modify: `src/plugin/database.ts`
- Test: `tests/integration/storage-migrations.test.ts`
- Create: `tests/storage/observability-repository.test.ts`

**Interfaces:**
- Consumes Task 1 contracts.
- Produces `getObservabilitySnapshot(scanId?)`, `setTracePreferences`, `deleteTraceForScan`, `deleteAllTraceData`, and `pruneExpiredTraceData` through `PluginDatabase`.

- [ ] **Step 1: Add failing migration/repository tests**

```ts
expect(repository.getObservabilitySnapshot("scan-1").timeline).toEqual([
  expect.objectContaining({ kind: "scanner", durationMs: 25 })
]);
expect(repository.getTraceInventory().categories.promptSnapshots.enabled).toBe(false);
```

- [ ] **Step 2: Run focused storage tests and confirm failure**

Run: `npx vitest run tests/integration/storage-migrations.test.ts tests/storage/observability-repository.test.ts`

- [ ] **Step 3: Add a forward-only migration and metadata-only queries**

Persist configuration fingerprints and preferences in migration 8. Return parsed, validated timeline, lineage, inventory, and aggregate metric rows. Deletion must remove only trace categories and preserve approvals/proposals/audit records.

- [ ] **Step 4: Add retention pruning and re-run tests**

Run: `npx vitest run tests/integration/storage-migrations.test.ts tests/storage/observability-repository.test.ts tests/storage/trace-retention.test.ts`

- [ ] **Step 5: Commit**

Commit: `git commit -m "feat: add observability storage queries"`

### Task 3: Governed Scan Instrumentation and Metrics

**Files:**
- Modify: `src/plugin/database.ts`
- Modify: `src/main.ts`
- Create: `src/observability/metrics.ts`
- Test: `tests/plugin/database.test.ts`
- Create: `tests/observability/metrics.test.ts`

**Interfaces:**
- Consumes repository APIs from Task 2 and fingerprint from Task 1.
- Produces root/child scan spans for scanner, indexing, retrieval, agent, validation, policy, coordinator, and finding stages plus content-free metric summaries.

- [ ] **Step 1: Write failing scan persistence/metrics tests**

```ts
expect(snapshot.timeline.map((span) => span.kind)).toEqual(
  expect.arrayContaining(["scanner", "indexing", "agent", "validation", "policy", "coordinator", "finding"])
);
expect(calculatePercentile([10, 20, 30], 0.95)).toBe(30);
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/plugin/database.test.ts tests/observability/metrics.test.ts`

- [ ] **Step 3: Persist bounded stage spans and fingerprinted scan configuration**

Use timestamps supplied by the scan facade or bounded monotonic durations. Record `not-run` stages explicitly as metadata/outcome-safe events, never as fabricated success. Map model trace duration/retries/token estimates into agent spans and aggregate only numeric fields.

- [ ] **Step 4: Re-run tests and commit**

Run: `npx vitest run tests/plugin/database.test.ts tests/observability/metrics.test.ts`

Commit: `git commit -m "feat: record scan observability metrics"`

### Task 4: Compact Workspace Inspector and Settings Controls

**Files:**
- Create: `src/ui/ObservabilityView.tsx`
- Modify: `src/ui/VaultStewardWorkspace.tsx`
- Modify: `src/main.ts`
- Modify: `src/plugin/settings.ts`
- Modify: `src/styles.css`
- Test: `tests/ui/workspace.test.tsx`
- Create: `tests/ui/observability-view.test.tsx`
- Modify: `tests/plugin/settings.test.ts`

**Interfaces:**
- Consumes `PluginDatabase.loadObservability`, `TracePreferences`, and repository read models.
- Produces a closed-by-default, keyboard-native Observability disclosure and settings controls for optional snapshot preference, exclusions, and retention.

- [ ] **Step 1: Write failing UI/settings tests**

```tsx
render(<ObservabilityView data={fixture} />);
expect(screen.getByText("Observability")).not.toHaveAttribute("open");
expect(screen.getByText("scanner")).toBeInTheDocument();
expect(screen.queryByText("note body content")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run focused UI/settings tests and confirm failure**

Run: `npx vitest run tests/ui/workspace.test.tsx tests/ui/observability-view.test.tsx tests/plugin/settings.test.ts`

- [ ] **Step 3: Implement compact view and preferences**

Render scan selection, fixed-label timeline rows, selected-finding lineage, fingerprint inputs, metrics, inventory, and deletion actions inside one collapsed disclosure. Use `details/summary`, semantic tables/lists, stable responsive CSS, and user-safe empty/error states. Settings use validated toggles/text inputs and persist through `saveSettings`.

- [ ] **Step 4: Re-run focused tests and commit**

Run: `npx vitest run tests/ui/workspace.test.tsx tests/ui/observability-view.test.tsx tests/plugin/settings.test.ts`

Commit: `git commit -m "feat: add local trace inspector"`

### Task 5: Phase Completion, Documentation, and Explanation

**Files:**
- Modify: `task.md` (ignored local task record)
- Modify: `docs/progress.md`
- Modify: `README.md` only if implemented behavior changes a documented capability
- Create: `/tmp/2026-07-16-explanation-phase-13-observability.html`

**Interfaces:**
- Consumes all Phase 13 contracts, storage, instrumentation, and UI behavior.
- Produces verified phase documentation and a self-contained interactive diff explanation outside the repository.

- [ ] **Step 1: Run the complete phase gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:acceptance && npm run eval:smoke && npm run eval:full && npm run security:check`

- [ ] **Step 2: Update phase records**

Tick only completed Phase 13 tasks in ignored `task.md`; update `docs/progress.md` with concrete behavior and actual verification results.

- [ ] **Step 3: Generate and validate the HTML explanation**

Inspect the final diff and create a single inline-CSS/JavaScript file outside the repository. Confirm all `<pre>` styles use `white-space: pre` or `pre-wrap`, all table-of-contents anchors resolve, and five quiz questions provide answer feedback.

- [ ] **Step 4: Commit, merge, and push after the completion gate**

Commit: `git commit -m "docs: complete phase 13 observability"`

Merge the phase branch into `development`, push `development`, and retain no staged `.superpowers/` content.
