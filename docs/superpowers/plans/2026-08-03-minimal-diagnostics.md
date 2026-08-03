# Minimal Diagnostics Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with deterministic tests first. Repository handoff instructions prohibit using Superpowers to implement code, so execute the steps directly in the current phase branch and review each task before continuing.

**Goal:** Replace the developer-heavy Diagnostics drawer with the four-section user support panel approved in `docs/superpowers/specs/2026-08-03-minimal-diagnostics-design.md`.

**Architecture:** Add one focused React `DiagnosticsView` that owns transient connection, maintenance-toggle, suppression, and trace-deletion UI state while consuming existing bounded plugin callbacks. `VaultStewardWorkspace` keeps suppression state because that state also filters the primary review path; `main.ts` supplies one cohesive diagnostics object and stops exposing advanced views. Core policy, observability, evaluation, change-impact, and storage modules remain intact.

**Tech Stack:** TypeScript, React, Obsidian Plugin API, Vitest, Testing Library, CSS container queries.

## Global Constraints

- Keep model connection checking, automatic-check status/pause, reviewed false-positive suppression, and deletion of all local diagnostic traces.
- Remove Policy Studio, manual impact inspection, observability details/export, prompt registry, quality/evaluation dashboards, replay guidance, AI debug console, and technical identifiers from the workspace.
- Do not change provider request shapes, scan results, findings, proposals, approvals, vault writes, or database schemas.
- Keep policy evaluation, trace capture, release evaluation, maintenance detection, and storage internals operational.
- Trace deletion requires confirmation and cannot delete notes, findings, approvals, feedback, or scan history.
- Model errors remain redacted; do not expose API keys, prompts, note excerpts, endpoint payloads, or raw model output.
- Preserve visible keyboard focus, DOM order matching visual order, live-region status semantics, narrow-pane single-column layout, and non-color status meaning.
- Add or update deterministic tests before each behavior change.
- Preserve unrelated working-tree changes and stage only files belonging to each task.

---

## File Map

### Create

- `src/ui/DiagnosticsView.tsx` — the only user-visible Diagnostics implementation.
- `tests/ui/diagnostics-view.test.tsx` — component behavior, privacy copy, confirmation, and accessibility assertions.

### Modify

- `src/ui/VaultStewardWorkspace.tsx` — accept one diagnostics contract, keep local suppression synchronized with the main review path, and render `DiagnosticsView`.
- `src/main.ts` — provide the minimal diagnostics callbacks and remove advanced workspace wiring/imports that become unused.
- `styles.css` — replace advanced Diagnostics styles with the approved card hierarchy and narrow-pane rules.
- `tests/ui/workspace.test.tsx` — prove the disclosure remains secondary and removed tools are absent.
- `spec.md` — narrow the v0.1 user-defined-policy promise while retaining policy-governed scanning.
- `docs/interfaces.md` — mark policy authoring and developer trace tools as internal/deferred rather than workspace contracts.
- `docs/manual-acceptance-suite.md` — replace the advanced Diagnostics journey with the four-section support journey.
- `docs/manual-acceptance-checklist.md` — remove obsolete release boxes and add the approved Diagnostics acceptance cases.
- `docs/progress.md` — record the deliberate v0.1 UI scope reduction.
- `docs/handoff-2026-08-03.md` — update the remaining manual acceptance scope if the handoff is still current when this plan executes.

### Remove after replacement tests pass

- `src/ui/MoreTools.tsx`
- `src/ui/ModelReadinessView.tsx`
- `src/ui/MaintenanceScheduleView.tsx`
- `src/ui/FeedbackLearningView.tsx`
- `src/ui/PolicyStudio.tsx`
- `src/ui/MaintenanceView.tsx`
- `src/ui/ObservabilityView.tsx`
- `src/ui/PromptRegistryView.tsx`
- `src/ui/QualityDiagnostics.tsx`
- Their direct UI test files under `tests/ui/`: `more-tools.test.tsx`, `model-readiness.test.tsx`, `feedback-learning-view.test.tsx`, `policy-studio.test.tsx`, `maintenance-view.test.tsx`, `observability-view.test.tsx`, `prompt-registry-view.test.tsx`, and `quality-diagnostics.test.tsx`.

Do not remove the non-UI policy, maintenance, observability, evaluation, prompt-registry, or storage modules used by governed scans and release verification.

---

### Task 1: Build The Four-Section Diagnostics Component

**Files:**

- Create: `src/ui/DiagnosticsView.tsx`
- Create: `tests/ui/diagnostics-view.test.tsx`

**Interfaces:**

- Consumes existing `ModelReadiness`, `MaintenanceSchedule`, `MaintenanceScheduleState`, `ReviewerFeedbackRecord`, and `recurringSuppressionCandidates` contracts.
- Produces:

```ts
export type DiagnosticsViewProps = {
  checkConnection: () => Promise<ModelReadiness>;
  maintenance: {
    schedule: MaintenanceSchedule;
    state: MaintenanceScheduleState;
    setPaused: (paused: boolean) => Promise<void>;
  };
  feedbackRecords: readonly ReviewerFeedbackRecord[];
  suppressedPatterns: readonly string[];
  suppressPattern: (pattern: string) => Promise<void>;
  deleteDiagnosticTraces: () => Promise<void>;
};

export function DiagnosticsView(props: DiagnosticsViewProps): JSX.Element;
```

- `VaultStewardWorkspace` in Task 2 consumes this exact props type.

- [ ] **Step 1: Write failing render and connection-state tests**

Create `tests/ui/diagnostics-view.test.tsx` with a shared `renderDiagnostics` helper and assert the four approved sections are present while technical limits are absent:

```tsx
const renderDiagnostics = (overrides: Partial<DiagnosticsViewProps> = {}) =>
  render(
    <DiagnosticsView
      checkConnection={async () => ({
        available: true,
        structuredOutput: true,
        provider: "hyperfusion",
        model: "qwen/qwen3-32b",
        timeoutMs: 30_000,
        maxResponseBytes: 65_536,
        latencyMs: 412
      })}
      maintenance={{
        schedule: {
          enabled: true,
          eventTriggered: true,
          intervalMinutes: 60,
          debounceMinutes: 5,
          maxRunsPerHour: 4,
          paused: true
        },
        state: {
          scanInProgress: false,
          runsInWindow: 0,
          lastRunAt: Date.parse("2026-08-03T12:52:00.000Z")
        },
        setPaused={vi.fn(async () => undefined)}
      }}
      feedbackRecords={[]}
      suppressedPatterns={[]}
      suppressPattern={vi.fn(async () => undefined)}
      deleteDiagnosticTraces={vi.fn(async () => undefined)}
      {...overrides}
    />
  );

it("shows only the four user support sections", () => {
  renderDiagnostics();
  expect(screen.getByText("Model connection")).toBeInTheDocument();
  expect(screen.getByText("Automatic checks")).toBeInTheDocument();
  expect(screen.getByText("Review preferences")).toBeInTheDocument();
  expect(screen.getByText("Local diagnostic data")).toBeInTheDocument();
  expect(screen.queryByText(/response limit/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/timeout/i)).not.toBeInTheDocument();
});

it("reports a successful connection without technical limits", async () => {
  renderDiagnostics();
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  expect(await screen.findByText("Model ready")).toBeInTheDocument();
  expect(screen.getByText("HyperFusion · qwen/qwen3-32b")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
npx vitest run tests/ui/diagnostics-view.test.tsx
```

Expected: FAIL because `src/ui/DiagnosticsView.tsx` does not exist.

- [ ] **Step 3: Implement the disclosure and model connection section**

Create `DiagnosticsView.tsx` with one outer `<details className="diagnostics-view">`, a `Diagnostics` summary, and a `.diagnostics-content` containing the four sections in approved DOM order. Use an explicit connection state:

```ts
type ConnectionState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ready"; provider: string; model: string }
  | { status: "error" };
```

Normalize only provider display names in a local helper:

```ts
function providerLabel(provider: string): string {
  if (provider === "hyperfusion") return "HyperFusion";
  if (provider === "openai") return "OpenAI";
  if (provider === "llama.cpp") return "llama.cpp";
  return provider === "ollama" ? "Ollama" : "Configured model";
}
```

On `Check connection`, set `checking`, await `checkConnection`, then set `ready` only when both `available` and `structuredOutput` are true. Convert all false results and thrown exceptions to `error`. Render `Checking model…` with `role="status"`, `Model ready` with `role="status"`, and `Model needs attention` with `role="alert"`. Never render `timeoutMs`, `maxResponseBytes`, `latencyMs`, or `failureCode`.

- [ ] **Step 4: Add failing maintenance, feedback, and deletion tests**

Add tests that assert:

```tsx
it("pauses and resumes automatic checks with one action", async () => {
  const setPaused = vi.fn(async () => undefined);
  renderDiagnostics({
    maintenance: {
      schedule: {
        enabled: true,
        eventTriggered: true,
        intervalMinutes: 60,
        debounceMinutes: 5,
        maxRunsPerHour: 4,
        paused: false
      },
      state: { scanInProgress: false, runsInWindow: 0, nextRunAt: 1785765600000 },
      setPaused
    }
  });
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  await waitFor(() => expect(setPaused).toHaveBeenCalledWith(true));
  expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
  expect(screen.queryByText(/incremental|full vault check/i)).not.toBeInTheDocument();
});

it("offers eligible suppression without rendering its raw key", () => {
  renderDiagnostics({
    feedbackRecords: [1, 2, 3].map((index) => ({
      id: `feedback-${index}`,
      findingId: `finding-${index}`,
      proposalId: null,
      verdict: "false-positive",
      label: "false-positive",
      patternKey: "task:Work/Plan.md",
      createdAt: "2026-08-03T00:00:00.000Z"
    }))
  });
  expect(screen.getByText("Repeated task issue in Work/Plan.md")).toBeInTheDocument();
  expect(screen.queryByText("task:Work/Plan.md")).not.toBeInTheDocument();
});

it("confirms before deleting all diagnostic traces", async () => {
  const deleteDiagnosticTraces = vi.fn(async () => undefined);
  renderDiagnostics({ deleteDiagnosticTraces });
  fireEvent.click(screen.getByRole("button", { name: "Delete diagnostic traces" }));
  expect(deleteDiagnosticTraces).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() => expect(deleteDiagnosticTraces).toHaveBeenCalledOnce());
  expect(screen.getByRole("status")).toHaveTextContent("Diagnostic traces deleted");
});
```

Also cover disabled maintenance, deletion cancellation, deletion rejection, and connection rejection.

- [ ] **Step 5: Run the expanded component test and verify the new cases fail**

Run:

```bash
npx vitest run tests/ui/diagnostics-view.test.tsx
```

Expected: connection tests pass; maintenance, suppression-label, and deletion tests fail because those behaviors are not implemented.

- [ ] **Step 6: Implement maintenance, feedback, and deletion behavior**

Use local `maintenancePaused`, `maintenancePending`, `confirmingDeletion`, and `dataMessage` state. Initialize paused state from `maintenance.schedule.paused`, update it only after `setPaused` succeeds, and show a redacted alert on failure. For disabled schedules, show `Disabled` and no enabled action.

Use `recurringSuppressionCandidates(feedbackRecords)` and format keys without rendering the raw colon-delimited value:

```ts
function feedbackPatternLabel(key: string): string {
  const separator = key.indexOf(":");
  if (separator < 1) return "Repeated issue pattern";
  const type = key.slice(0, separator).replaceAll("-", " ");
  const notes = key.slice(separator + 1).split("|").filter(Boolean);
  if (notes.length === 1) return `Repeated ${type} issue in ${notes[0]}`;
  return `Repeated ${type} issue across ${notes.length} notes`;
}
```

Deletion must show `Confirm deletion` and `Cancel`, call only `deleteDiagnosticTraces`, and use `role="status"` for success or `role="alert"` for failure. Keep the exact copy: `Deleting traces never changes your notes or issue history.`

- [ ] **Step 7: Run the focused component test**

Run:

```bash
npx vitest run tests/ui/diagnostics-view.test.tsx
```

Expected: PASS for all Diagnostics component cases.

- [ ] **Step 8: Commit the isolated component**

```bash
git add src/ui/DiagnosticsView.tsx tests/ui/diagnostics-view.test.tsx
git commit -m "feat: add minimal diagnostics view"
```

---

### Task 2: Integrate Diagnostics And Remove Advanced Workspace Surfaces

**Files:**

- Modify: `src/ui/VaultStewardWorkspace.tsx`
- Modify: `src/main.ts`
- Modify: `tests/ui/workspace.test.tsx`
- Remove the obsolete UI and UI-test files listed in the File Map.

**Interfaces:**

- Consumes `DiagnosticsViewProps` from Task 1.
- `VaultStewardWorkspace` produces this public prop:

```ts
diagnostics?: Omit<
  DiagnosticsViewProps,
  "feedbackRecords" | "suppressedPatterns" | "suppressPattern"
> & {
  loadFeedback: () => ReviewerFeedbackRecord[];
  suppressedPatterns: readonly string[];
  suppressPattern: (pattern: string) => Promise<void>;
};
```

- The workspace remains the owner of the mutable suppression list because `chooseNext`, `activeFindings`, and `listedFindings` consume it.

- [ ] **Step 1: Replace the existing workspace test setup with a failing minimal contract test**

In `tests/ui/workspace.test.tsx`, update the first-render case to supply `diagnostics` and assert:

```tsx
expect(screen.getByText("Diagnostics").closest("details")).not.toHaveAttribute("open");
fireEvent.click(screen.getByText("Diagnostics"));
expect(screen.getByText("Model connection")).toBeInTheDocument();
expect(screen.getByText("Automatic checks")).toBeInTheDocument();
expect(screen.getByText("Review preferences")).toBeInTheDocument();
expect(screen.getByText("Local diagnostic data")).toBeInTheDocument();
for (const removed of [
  "Policy Studio",
  "Maintenance",
  "Inspect change impact",
  "Observability",
  "Prompt registry",
  "Evaluation and quality",
  "AI debug console"
]) {
  expect(screen.queryByText(removed)).not.toBeInTheDocument();
}
```

Keep the existing assertion that Settings and History remain separate from Diagnostics.

- [ ] **Step 2: Run workspace tests and verify the contract mismatch fails**

Run:

```bash
npx vitest run tests/ui/workspace.test.tsx
```

Expected: FAIL because the workspace still accepts individual advanced props and renders `MoreTools`.

- [ ] **Step 3: Replace individual Diagnostics props with the cohesive contract**

In `VaultStewardWorkspace.tsx`:

- import `DiagnosticsView` and `DiagnosticsViewProps`;
- remove imports for the nine old UI components;
- replace `policyStudio`, `checkModelReadiness`, `maintenance`, `inspectImpact`, `loadObservability`, `deleteScanTrace`, `deleteAllTraceData`, `loadReviewerFeedback`, and `suppressFindingPattern` parameters with `diagnostics`;
- initialize `localSuppressionPatterns` from `diagnostics?.suppressedPatterns ?? []`;
- load feedback from `diagnostics?.loadFeedback() ?? []`;
- render one `DiagnosticsView` after the Settings/History utilities;
- wrap `diagnostics.suppressPattern` so a successful call also adds the pattern to `localSuppressionPatterns`;
- remove `prepareMaintenanceRepair` if no remaining caller uses it.

The render call must have this shape:

```tsx
{diagnostics ? (
  <DiagnosticsView
    checkConnection={diagnostics.checkConnection}
    maintenance={diagnostics.maintenance}
    feedbackRecords={reviewerFeedback}
    suppressedPatterns={localSuppressionPatterns}
    suppressPattern={async (pattern) => {
      await diagnostics.suppressPattern(pattern);
      setLocalSuppressionPatterns((current) => [...new Set([...current, pattern])]);
    }}
    deleteDiagnosticTraces={diagnostics.deleteDiagnosticTraces}
  />
) : null}
```

- [ ] **Step 4: Narrow the plugin-to-workspace wiring**

In `VaultStewardStatusItemView.onOpen` in `src/main.ts`, replace the advanced props with:

```ts
diagnostics: {
  checkConnection: () => this.plugin.checkModelReadiness(),
  maintenance: {
    schedule: this.plugin.settings.maintenanceSchedule,
    state: this.plugin.getMaintenanceState(),
    setPaused: (paused) => this.plugin.setMaintenancePaused(paused)
  },
  loadFeedback: () => this.plugin.listReviewerFeedback(),
  suppressedPatterns: this.plugin.settings.suppressedFindingPatterns,
  suppressPattern: (pattern) => this.plugin.suppressFindingPattern(pattern),
  deleteDiagnosticTraces: () => this.plugin.deleteAllTraceData()
}
```

Remove imports that existed only for Policy Studio UI authoring or impact-inspector wiring. Keep `loadPolicyDraft()` because governed scans still consume existing compatible policy files. Remove the `previewPolicyDraft`, `draftPolicyRuleFromFinding`, and `savePolicyDraft` plugin methods only after `rg` confirms no non-UI caller remains.

Change the active-policy error mapping from `Open Diagnostics to review it.` to `The custom policy file is invalid. Restore or remove .vault-steward/policy.yaml, then check the vault again.` Do not include an absolute path.

- [ ] **Step 5: Remove obsolete UI files and their direct tests**

After `rg` proves each has no remaining import, remove only the UI files and test files listed in the File Map. Do not remove:

```text
src/policy/**
src/maintenance/**
src/observability/**
src/indexing/impact.ts
src/storage/**
tests/policy/**
tests/maintenance/**
tests/observability/**
tests/plugin/database.test.ts
```

- [ ] **Step 6: Run focused integration and surviving core tests**

Run:

```bash
npx vitest run tests/ui/workspace.test.tsx tests/ui/diagnostics-view.test.tsx tests/feedback/local-learning.test.ts tests/model-provider/readiness.test.ts tests/policy/studio.test.ts tests/plugin/database.test.ts
```

Expected: PASS. Policy and observability core tests remain green even though their advanced views are gone.

- [ ] **Step 7: Run static and import checks**

Run:

```bash
rg -n "MoreTools|PolicyStudio|MaintenanceView|ObservabilityView|PromptRegistryView|QualityDiagnostics|AIDebugConsole" src tests
npm run typecheck
npm run lint
```

Expected: `rg` finds no removed UI imports; typecheck and lint pass.

- [ ] **Step 8: Commit the workspace reduction**

```bash
git add src/main.ts src/ui/VaultStewardWorkspace.tsx src/ui/DiagnosticsView.tsx tests/ui
git add -u src/ui tests/ui
git commit -m "refactor: simplify diagnostics workspace"
```

Before committing, inspect `git diff --cached --name-only` and unstage any unrelated acceptance-fix file.

---

### Task 3: Match The Approved Card Layout And Narrow-Pane Behavior

**Files:**

- Modify: `styles.css`
- Modify: `tests/ui/diagnostics-view.test.tsx`

**Interfaces:**

- Consumes the class names created in Task 1: `.diagnostics-view`, `.diagnostics-content`, `.diagnostic-card`, `.diagnostic-card-heading`, `.diagnostic-status`, `.diagnostic-action`, `.diagnostic-data`, and `.diagnostic-confirmation`.
- Produces no TypeScript API.

- [ ] **Step 1: Add semantic structure assertions before styling**

Extend `diagnostics-view.test.tsx` to assert:

```tsx
const diagnostics = screen.getByText("Diagnostics").closest("details");
expect(diagnostics).not.toHaveAttribute("open");
fireEvent.click(screen.getByText("Diagnostics"));
const sections = within(diagnostics!).getAllByRole("region");
expect(sections.map((section) => section.getAttribute("aria-label"))).toEqual([
  "Model connection",
  "Automatic checks",
  "Review preferences",
  "Local diagnostic data"
]);
```

Give every region an accessible name and keep buttons after their corresponding explanatory text in DOM order.

- [ ] **Step 2: Run the semantic test and verify it fails if structure is incomplete**

Run:

```bash
npx vitest run tests/ui/diagnostics-view.test.tsx
```

Expected: FAIL until the regions and names match the approved order exactly.

- [ ] **Step 3: Add focused Diagnostics styles and delete obsolete advanced-view styles**

In `styles.css`, implement:

```css
.diagnostics-content {
  display: grid;
  gap: 0.75rem;
  padding-block: 1rem;
}

.diagnostic-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  background: var(--background-primary);
}

.diagnostic-card h3,
.diagnostic-card p {
  margin-block: 0;
}

.diagnostic-card p + p,
.diagnostic-confirmation {
  margin-top: 0.5rem;
}

.diagnostic-status[data-state="ready"] {
  color: var(--text-success);
}

.diagnostic-status[data-state="error"] {
  color: var(--text-error);
}

.diagnostic-data {
  grid-template-columns: 1fr;
}

@container vault-steward (max-width: 34rem) {
  .diagnostic-card {
    grid-template-columns: 1fr;
  }

  .diagnostic-action,
  .diagnostic-confirmation button {
    width: 100%;
  }
}
```

Use the repository's existing Obsidian variables if a named variable above is unavailable. Remove selectors used only by the deleted feedback, maintenance-inspector, observability, prompt-registry, quality, debug, and Policy Studio components. Do not alter prepared-fix or judgment styles.

- [ ] **Step 4: Run UI tests, format, and build**

Run:

```bash
npx vitest run tests/ui/diagnostics-view.test.tsx tests/ui/workspace.test.tsx
npm run format:check
npm run typecheck
npm run build
```

Expected: all commands pass and the production CSS bundle contains the Diagnostics card selectors.

- [ ] **Step 5: Commit the approved layout**

```bash
git add styles.css src/ui/DiagnosticsView.tsx tests/ui/diagnostics-view.test.tsx
git commit -m "style: focus diagnostics on user controls"
```

---

### Task 4: Align Product Documentation And Acceptance Coverage

**Files:**

- Modify: `spec.md`
- Modify: `docs/interfaces.md`
- Modify: `docs/manual-acceptance-suite.md`
- Modify: `docs/manual-acceptance-checklist.md`
- Modify: `docs/progress.md`
- Modify: `docs/handoff-2026-08-03.md` if it still governs the active task.

**Interfaces:**

- No runtime API.
- Produces the release acceptance contract for the simplified Diagnostics surface.

- [ ] **Step 1: Update authoritative product scope**

In `spec.md`, keep `Policy-governed` as a core principle and the deterministic Policy Agent/Engine architecture. Replace the v0.1 implication that the workspace exposes user-defined YAML authoring with explicit scope:

```markdown
Vault Steward evaluates deterministic governance policy during scans. The v0.1
workspace uses the built-in policy path and does not expose policy authoring;
custom Policy Studio editing is deferred from the release interface.
```

Do not remove the examples of rules the policy engine can evaluate.

- [ ] **Step 2: Update interface and manual acceptance contracts**

In `docs/interfaces.md`, retain the internal Policy Template Contract but preface it with:

```markdown
Policy-template parsing and validation remain internal contracts. Policy Studio
authoring is not exposed in the v0.1 workspace.
```

In `docs/manual-acceptance-suite.md`, replace the advanced Diagnostics list with:

```markdown
Diagnostics stays collapsed until requested and contains only model connection,
automatic-check status, reviewed local suppression, and confirmed deletion of
local diagnostic traces. Developer observability, policy authoring, prompt
registry, evaluation dashboards, replay guidance, manual impact inspection, and
the AI debug console are not part of the release workspace.
```

- [ ] **Step 3: Update the checklist without manufacturing manual evidence**

Remove obsolete unchecked boxes for Policy Studio, observability dashboards, replay, prompt registry, manual impact inspection, and debug console. Add unchecked boxes for:

```markdown
- [ ] Diagnostics contains only Model connection, Automatic checks, Review preferences, and Local diagnostic data.
- [ ] Model connection reports ready or needs attention without timeout, response-size, prompt, content, or credential details.
- [ ] Automatic checks show human-readable status and pause/resume without scan-plan terminology.
- [ ] Review preferences offer suppression only after three explicit matching false-positive dismissals and never show a raw pattern key.
- [ ] Delete diagnostic traces requires confirmation and leaves notes, findings, approvals, feedback, and History unchanged.
```

Keep existing checked manual evidence intact unless the changed UI invalidates that exact observation. Record UI-05 as resolved only after the installed package no longer shows release-validation wording as an active operation.

- [ ] **Step 4: Record the intentional deviation and update handoff state**

Append a dated `docs/progress.md` entry naming the approved design spec and explaining that advanced systems remain internal while their v0.1 workspace surfaces were removed. Update the active handoff's remaining-manual-testing section to point at the five new Diagnostics boxes. Do not mark them passed from automated tests.

- [ ] **Step 5: Run documentation and full completion gates**

Run the narrow documentation checks first:

```bash
npm run format:check
rg -n "Policy Studio|Prompt registry|AI debug console|Evaluation and quality|Inspect change impact" spec.md docs/manual-acceptance-suite.md docs/manual-acceptance-checklist.md
```

Expected: any remaining matches describe removed/deferred UI or historical evidence, not current release requirements.

Then run the full user-facing completion gate:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:acceptance
npm run eval:smoke
npm run eval:full
npm run security:check
```

If a command is unavailable because of environment/provider requirements, record that exact limitation rather than claiming it passed.

- [ ] **Step 6: Build and install the manual-test package**

Run:

```bash
npm run package:plugin
```

Verify `dist/manifest.json`, `dist/main.js`, `dist/styles.css`, `dist/sql-wasm.wasm`, and `dist/release-manifest.json` are present. Copy only those rebuilt plugin artifacts into the disposable acceptance vault's existing plugin directory after confirming the target path; do not overwrite any note or database file.

- [ ] **Step 7: Commit documentation and release-test alignment**

```bash
git add spec.md docs/interfaces.md docs/manual-acceptance-suite.md docs/manual-acceptance-checklist.md docs/progress.md
git add docs/handoff-2026-08-03.md
git commit -m "docs: narrow diagnostics release surface"
```

If the handoff file is intentionally untracked user work at execution time, leave it unstaged and state that explicitly.

---

## Manual Handoff After Implementation

After installing the rebuilt package, ask the user to verify only these cases in order:

1. Diagnostics is collapsed by default and opens beneath Settings and History.
2. Exactly four sections appear with no developer-facing panels or IDs.
3. Check connection succeeds with HyperFusion and reports only provider/model readiness.
4. Pause then resume automatic checks; the displayed state updates clearly.
5. Review preferences shows its empty state or eligible suppression without a raw key.
6. Cancel trace deletion once, then confirm it; verify notes and History remain unchanged.
7. Repeat in a narrow pane and dark theme to confirm no clipping or contrast loss.

Tick manual acceptance boxes only from the user's observed results.
