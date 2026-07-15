# Actionable Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sequential review workspace with a responsive, severity-led dashboard that makes the latest vault health and next safe review action immediately clear.

**Architecture:** Keep the active queue as findings from the latest completed scan and derive dashboard presentation through pure UI helpers. `VaultStewardWorkspace` owns scan and selected-finding state, while focused dashboard components render health, prioritization, detail, and collapsible history. Existing proposal review and apply workflows remain unchanged and are exposed only for an eligible selected broken-reference finding.

**Tech Stack:** TypeScript, React 19, Obsidian Plugin API, native HTML controls, Vitest, Testing Library, esbuild, local `sql.js` packaging.

## Global Constraints

- Create `feat/phase-11-actionable-dashboard` from `development`; merge it into `development` and push only after the Phase 11 completion gate passes.
- Keep all vault mutations behind the existing explicit proposal approval and stale-revision validation workflow.
- The active dashboard queue uses the latest completed scan only; SQLite history remains queryable and is never deleted.
- Rank Next best action by critical/high/medium/low/info severity, confidence descending, then finding ID ascending.
- Do not import Obsidian APIs into UI/core helpers; dashboard components receive typed data and callbacks only.
- Use native semantic controls, visible labels, keyboard-reachable finding selection, and narrow-pane-safe layout.
- Add `styles.css` as a packaged Obsidian plugin artifact; retain `main.js`, `manifest.json`, and `sql-wasm.wasm`.
- Run focused tests before broad verification, update `README.md` and `docs/upgrade-notes.md` with user-facing behavior, tick the ignored local `task.md`, and commit each completed task.

---

## File Structure

- `src/ui/dashboard.ts`: pure severity ordering, active finding selection, and count derivation.
- `src/ui/VaultHealthSummary.tsx`: current vault/scan state and text-based severity counts.
- `src/ui/NextBestAction.tsx`: one severity-ranked selected finding and a keyboard-native open action.
- `src/ui/PriorityFindings.tsx`: compact severity-grouped finding controls and selected state.
- `src/ui/FindingDetail.tsx`: selected evidence, limitations, and an explicit repair slot for eligible references.
- `src/ui/VaultStewardWorkspace.tsx`: orchestration of latest findings, selected finding, scan state, detail, proposal review, and collapsible history.
- `src/main.ts`: Obsidian ribbon launcher registration beside the existing command-palette entry point.
- `styles.css`: responsive plugin-only styles for dashboard sections, severity counts, selected detail, and narrow panes.
- `esbuild.config.mjs`, `scripts/package-plugin.ts`, `src/packaging/install.ts`: build/package/install `styles.css` with the plugin.
- `tests/ui/dashboard.test.tsx`, `tests/ui/workspace.test.tsx`, `tests/plugin/commands.test.ts`, `tests/packaging/*.test.ts`: dashboard ranking/state/accessibility, launcher, and stylesheet-artifact coverage.
- `README.md`, `docs/upgrade-notes.md`: capability and installation documentation.

## Task 1: Deterministic Dashboard Model

**Files:** Create `src/ui/dashboard.ts`, `tests/ui/dashboard.test.tsx`.

**Interfaces:**

```ts
export type DashboardCounts = Record<FindingSeverity, number>;
export const DASHBOARD_SEVERITIES: readonly FindingSeverity[];
export function rankDashboardFindings(findings: readonly Finding[]): Finding[];
export function selectNextBestAction(findings: readonly Finding[]): Finding | undefined;
export function countDashboardFindings(findings: readonly Finding[]): DashboardCounts;
export function selectDashboardFinding(
  findings: readonly Finding[],
  selectedId: string | undefined
): Finding | undefined;
```

- [ ] **Step 1: Write failing ranking and count tests in `tests/ui/dashboard.test.tsx`.**

```tsx
expect(rankDashboardFindings([low, high, highLowerConfidence, critical])).toEqual([
  critical,
  high,
  highLowerConfidence,
  low
]);
expect(selectNextBestAction([medium, high])).toMatchObject({ id: "high" });
expect(countDashboardFindings([critical, critical, low, info])).toEqual({
  critical: 2,
  high: 0,
  medium: 0,
  low: 1,
  info: 1
});
expect(selectDashboardFinding([high], "missing")).toBeUndefined();
```

- [ ] **Step 2: Run the focused test and confirm it fails because the dashboard module is missing.**

Run: `npx vitest run tests/ui/dashboard.test.tsx`

Expected: FAIL with a module-resolution error for `src/ui/dashboard.ts`.

- [ ] **Step 3: Implement `src/ui/dashboard.ts` with a closed severity ranking and no UI/state imports.**

```ts
export const DASHBOARD_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export function rankDashboardFindings(findings: readonly Finding[]): Finding[] {
  const severityIndex = new Map(DASHBOARD_SEVERITIES.map((severity, index) => [severity, index]));
  return [...findings].sort(
    (left, right) =>
      (severityIndex.get(left.severity) ?? DASHBOARD_SEVERITIES.length) -
        (severityIndex.get(right.severity) ?? DASHBOARD_SEVERITIES.length) ||
      right.confidence - left.confidence ||
      left.id.localeCompare(right.id)
  );
}
```

Use `DASHBOARD_SEVERITIES` to initialize every count at zero. `selectDashboardFinding` returns only a finding whose ID is in its provided active queue.

- [ ] **Step 4: Run the focused test, typecheck, and formatter.**

Run: `npx vitest run tests/ui/dashboard.test.tsx && npm run typecheck && npm run format:check`

Expected: PASS with ranking, tie-breaker, count, and stale-selection assertions passing.

- [ ] **Step 5: Commit the model and tests.**

```bash
git add src/ui/dashboard.ts tests/ui/dashboard.test.tsx
git commit -m "feat: add dashboard finding ranking"
```

## Task 2: Health, Next Action, and Priority Components

**Files:** Create `src/ui/VaultHealthSummary.tsx`, `src/ui/NextBestAction.tsx`, `src/ui/PriorityFindings.tsx`; modify `tests/ui/dashboard.test.tsx`.

**Interfaces:**

```ts
export function VaultHealthSummary(props: {
  vaultLabel: string;
  findings: readonly Finding[];
  lastCompletedAt?: string;
}): JSX.Element;
export function NextBestAction(props: {
  finding?: Finding;
  onOpen: (findingId: string) => void;
}): JSX.Element;
export function PriorityFindings(props: {
  findings: readonly Finding[];
  selectedFindingId?: string;
  onSelect: (findingId: string) => void;
}): JSX.Element;
```

- [ ] **Step 1: Add failing component tests that exercise health counts, severity-first action, selection, and the empty state.**

```tsx
render(<VaultHealthSummary vaultLabel="Test vault" findings={[critical, low]} />);
expect(screen.getByText("Critical 1")).toBeInTheDocument();
render(<NextBestAction finding={critical} onOpen={onOpen} />);
fireEvent.click(screen.getByRole("button", { name: /review critical finding/i }));
expect(onOpen).toHaveBeenCalledWith(critical.id);
render(
  <PriorityFindings
    findings={[low, critical]}
    selectedFindingId={critical.id}
    onSelect={onSelect}
  />
);
expect(screen.getByRole("button", { name: /critical.*selected/i })).toHaveAttribute(
  "aria-pressed",
  "true"
);
```

- [ ] **Step 2: Run the focused UI test and confirm it fails because the components are not exported.**

Run: `npx vitest run tests/ui/dashboard.test.tsx`

Expected: FAIL with missing-module or missing-export errors for the three dashboard components.

- [ ] **Step 3: Implement semantic dashboard components using the Task 1 model.**

```tsx
<section aria-label="Vault health">
  <h2>Vault health</h2>
  <p>Current vault: {vaultLabel}</p>
  <ul aria-label="Finding counts">
    {DASHBOARD_SEVERITIES.map((severity) => (
      <li key={severity}>
        {capitalize(severity)} {counts[severity]}
      </li>
    ))}
  </ul>
</section>
```

`PriorityFindings` must call `rankDashboardFindings`, render one native `button` per finding, expose selection with `aria-pressed`, and include severity plus explanation in its accessible name. `NextBestAction` must show a no-findings message when it receives no finding and must not render an action button in that state.

- [ ] **Step 4: Run component tests and broader existing review-queue tests.**

Run: `npx vitest run tests/ui/dashboard.test.tsx tests/ui/review-queue.test.tsx && npm run typecheck && npm run format:check`

Expected: PASS with keyboard-native button selection and empty-state assertions passing.

- [ ] **Step 5: Commit the dashboard presentation components.**

```bash
git add src/ui/dashboard.ts src/ui/VaultHealthSummary.tsx src/ui/NextBestAction.tsx src/ui/PriorityFindings.tsx tests/ui/dashboard.test.tsx
git commit -m "feat: add vault health dashboard components"
```

## Task 3: Workspace Orchestration, Detail, and Safe States

**Files:** Create `src/ui/FindingDetail.tsx`; modify `src/ui/VaultStewardWorkspace.tsx`, `tests/ui/workspace.test.tsx`, `tests/ui/dashboard.test.tsx`.

**Interfaces:**

```ts
export function FindingDetail(props: { finding?: Finding; children?: ReactNode }): JSX.Element;
```

`VaultStewardWorkspace` keeps `findings` as the last successfully loaded active queue. It adds `selectedFindingId`, derives `selectedFinding` with `selectDashboardFinding`, and chooses `selectNextBestAction(findings)` when selection is absent or stale.

- [ ] **Step 1: Add failing workspace tests for retained findings, selected detail, repair eligibility, and collapsed history.**

```tsx
const scan = vi
  .fn<() => Promise<ScanResult>>()
  .mockResolvedValueOnce({ scanId: "first", findings: [brokenReference, taskFinding] })
  .mockRejectedValueOnce(new Error("offline"));
render(<VaultStewardWorkspace vaultLabel="Test vault" scan={scan} />);
await user.click(screen.getByRole("button", { name: "Run scan" }));
await user.click(screen.getByRole("button", { name: /task finding/i }));
expect(screen.getByRole("region", { name: "Finding detail" })).toHaveTextContent(
  taskFinding.explanation
);
expect(screen.queryByLabelText("Reference target")).toBeNull();
await user.click(screen.getByRole("button", { name: "Run scan" }));
await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not complete"));
expect(screen.getByText(brokenReference.explanation)).toBeInTheDocument();
```

- [ ] **Step 2: Run workspace tests and confirm they fail against the sequential workspace.**

Run: `npx vitest run tests/ui/workspace.test.tsx tests/ui/dashboard.test.tsx`

Expected: FAIL because no priority selection/detail exists and the current failure handler clears findings.

- [ ] **Step 3: Replace the sequential queue/always-visible repair section with dashboard orchestration.**

```tsx
const rankedFindings = rankDashboardFindings(findings);
const selectedFinding =
  selectDashboardFinding(rankedFindings, selectedFindingId) ?? selectNextBestAction(rankedFindings);

<VaultHealthSummary vaultLabel={vaultLabel} findings={rankedFindings} lastCompletedAt={latestCompletedAt} />
<NextBestAction finding={selectNextBestAction(rankedFindings)} onOpen={setSelectedFindingId} />
<PriorityFindings
  findings={rankedFindings}
  selectedFindingId={selectedFinding?.id}
  onSelect={setSelectedFindingId}
/>
<FindingDetail finding={selectedFinding}>{repairControls}</FindingDetail>
```

Do not call `setFindings([])` in the scan catch path. Store the completed scan timestamp after a successful scan or initial history load. Render reference target/preparation controls only when `selectedFinding?.type === "broken-reference"`; pass that finding ID directly to `createProposal`. Wrap `HistoryView` in `<details><summary>History</summary>...</details>` and provide the same treatment for diagnostics when present.

- [ ] **Step 4: Keep proposal review behavior unchanged and verify the repair control remains explicit.**

Run: `npx vitest run tests/ui/workspace.test.tsx tests/ui/proposal-review-panel.test.tsx tests/ui/reference-findings.test.tsx`

Expected: PASS with no repair controls for task findings, a selected broken-reference repair path, retained content after failure, and unchanged approval/apply tests.

- [ ] **Step 5: Run focused UI regression checks and commit.**

Run: `npx vitest run tests/ui && npm run typecheck && npm run format:check`

```bash
git add src/ui/FindingDetail.tsx src/ui/VaultStewardWorkspace.tsx tests/ui/dashboard.test.tsx tests/ui/workspace.test.tsx
git commit -m "feat: make review workspace actionable"
```

## Task 4: Ribbon Launcher and Responsive Plugin Styling

**Files:** Create `styles.css`; modify `src/main.ts`, `esbuild.config.mjs`, `scripts/package-plugin.ts`, `src/packaging/install.ts`, `tests/plugin/commands.test.ts`, `tests/packaging/install.test.ts`, `tests/packaging/release-manifest.test.ts`.

**Interfaces:**

```ts
const openDashboard = () => {
  void this.openStatusView();
};
this.addRibbonIcon("shield-check", "Open Vault Steward", openDashboard);
```

`requiredInstallArtifacts()` returns `readonly ["main.js", "manifest.json", "sql-wasm.wasm", "styles.css", "release-manifest.json"]` in that order. `artifactNames` includes `styles.css` before release-manifest generation.

- [ ] **Step 1: Add failing launcher/package tests.**

```ts
expect(requiredInstallArtifacts()).toEqual([
  "main.js",
  "manifest.json",
  "sql-wasm.wasm",
  "styles.css",
  "release-manifest.json"
]);
expect(await readFile(resolve(root, "styles.css"), "utf8")).toContain(".vault-steward-dashboard");
```

Add a source-level lifecycle assertion only if the existing Obsidian test harness cannot instantiate `Plugin`: it must assert `src/main.ts` contains `addRibbonIcon("shield-check", "Open Vault Steward"` and preserve the command registration assertion.

- [ ] **Step 2: Run packaging and command tests and confirm stylesheet/launcher failures.**

Run: `npx vitest run tests/plugin/commands.test.ts tests/packaging/install.test.ts tests/packaging/release-manifest.test.ts`

Expected: FAIL because `styles.css` is absent from installation artifacts and no ribbon launcher exists.

- [ ] **Step 3: Add scoped responsive CSS and package it.**

```css
.vault-steward-dashboard {
  display: grid;
  gap: 16px;
  max-width: 860px;
}

.vault-steward-dashboard__counts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 480px) {
  .vault-steward-dashboard__counts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

Use Obsidian CSS variables for colors, backgrounds, borders, and focus styles. Do not create gradients, cards inside cards, icon-only actions without labels/tooltips, or fixed-width text controls. Copy `styles.css` into the release directory and include it in its SHA-256 release manifest.

- [ ] **Step 4: Register the ribbon launcher and verify package artifacts.**

Run: `npx vitest run tests/plugin/commands.test.ts tests/packaging/install.test.ts tests/packaging/release-manifest.test.ts && npm run package:plugin && npm run test:plugin-install`

Expected: PASS and `dist/vault-steward/` contains `main.js`, `manifest.json`, `sql-wasm.wasm`, `styles.css`, and `release-manifest.json`.

- [ ] **Step 5: Commit launcher, stylesheet, and packaging updates.**

```bash
git add src/main.ts styles.css esbuild.config.mjs scripts/package-plugin.ts src/packaging/install.ts tests/plugin/commands.test.ts tests/packaging/install.test.ts tests/packaging/release-manifest.test.ts
git commit -m "feat: add dashboard launcher and styles"
```

## Task 5: Documentation, Completion Gate, and Phase Promotion

**Files:** Modify `README.md`, `docs/upgrade-notes.md`, `docs/progress.md`, ignored `task.md`.

- [ ] **Step 1: Update user-facing documentation.**

Add the following capability language to `README.md` without referring to phases or delivery progress:

```md
- An actionable dashboard that summarizes the latest completed scan, prioritizes the highest-severity finding, and keeps evidence, history, and approved repair review in one local workspace.
```

In `docs/upgrade-notes.md`, state that installs now include `styles.css`, and that Vault Steward opens from either the left-ribbon shield icon or the `Open Vault Steward status` command-palette command.

- [ ] **Step 2: Tick all Phase 11 tasks in ignored `task.md` only after every verification step has passed.**

```md
- [x] 11.1 Define and test pure active-queue ranking...
- [x] 11.2 Replace the sequential workspace...
- [x] 11.3 Preserve last successful findings...
- [x] 11.4 Add a persistent ribbon launcher...
- [x] 11.5 Complete dashboard accessibility...
```

- [ ] **Step 3: Run the full completion gate.**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:plugin-install
npm run security:check
```

Expected: all available commands PASS. State explicitly if `npm run test:e2e` has no tests or if manual Obsidian checks cannot be run in the current environment.

- [ ] **Step 4: Perform the manual Obsidian desktop acceptance check.**

1. Copy `dist/vault-steward/` into `.obsidian/plugins/vault-steward/`, disable/re-enable the plugin, and reload Obsidian.
2. Open Vault Steward from the left-ribbon shield and again from the command palette.
3. Scan a vault with critical/high/medium/low fixtures; confirm the highest severity is Next best action.
4. Select a task finding; confirm no reference-repair controls appear.
5. Select a broken reference; prepare, approve, and apply a repair; confirm the existing stale-proposal protection still rejects a changed source.
6. Trigger an unavailable-model failure after a successful scan; confirm the last successful dashboard remains visible and Run scan remains enabled.
7. Narrow the sidebar; confirm counts and controls wrap without clipping or overlap.

- [ ] **Step 5: Commit, merge, push, and package the phase.**

```bash
git add README.md docs/upgrade-notes.md docs/progress.md
git commit -m "docs: document actionable dashboard"
git switch development
git merge --no-ff feat/phase-11-actionable-dashboard -m "merge: add actionable dashboard"
git push origin development
npm run package:plugin
```

## Plan Self-Review

- **Spec coverage:** Task 1 implements stable ranking/counts and latest-queue assumptions. Task 2 builds the health, next-action, and priority surfaces. Task 3 implements selected detail, repair eligibility, retained scanning/failure context, and collapsible history. Task 4 implements the ribbon launcher, responsive styling, and stylesheet packaging. Task 5 documents, tests, manually accepts, and promotes the completed phase.
- **Placeholder scan:** The plan contains no unfinished markers. Every task names exact files, interfaces, test assertions, commands, and commit boundaries.
- **Type consistency:** Every later component consumes the `Finding`-based dashboard model from Task 1. The workspace owns selection and passes IDs/callbacks to components; only the selected eligible broken-reference finding reaches the pre-existing repair workflow.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-15-actionable-dashboard.md`. Phase 11 implementation will proceed inline without Superpowers implementation skills, per the repository's user-authored guidance.
