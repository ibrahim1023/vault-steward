# Focused Review Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowded sequential workspace with the approved teal review workbench while preserving all scan, evidence, proposal, approval, and apply safety contracts.

**Architecture:** Keep `VaultStewardWorkspace` as the orchestration boundary. Extend pure dashboard helpers for compact queue selection and filtering, compose the queue and selected detail inside a responsive workbench, and place existing operational tools behind one `More` disclosure. No scanner, repository, provider, or review-workflow behavior changes.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, Obsidian CSS variables, existing esbuild packaging.

## Global Constraints

- Keep core modules independent of Obsidian APIs; UI components receive typed props and callbacks only.
- Preserve latest-completed-scan queue semantics and existing severity/confidence/ID ranking.
- Preserve deterministic proposal creation, explicit approval, apply confirmation, stale protection, and post-write re-index behavior.
- Use teal as the product/selection accent, amber for attention, muted green for low-risk/completed state, and red only for failures; no meaning may depend on color alone.
- Do not add external dependencies, telemetry, remote assets, or cloud calls.
- Use native buttons, inputs, selects, and disclosures with visible keyboard focus.
- Start implementation on `feat/phase-19-focused-review-workbench`, fast-forward it into `development`, and push only after the phase completion gate passes.

---

## File Structure

- Modify `src/ui/dashboard.ts`: add pure compact-queue, severity-filter, and text-filter helpers.
- Modify `src/ui/PriorityFindings.tsx`: render compact/full source-aware queue rows and filter controls.
- Modify `src/ui/VaultHealthSummary.tsx`: render semantic count summary rather than count buttons.
- Modify `src/ui/FindingDetail.tsx`: add a narrow primary-action region without moving evidence ownership.
- Create `src/ui/MoreTools.tsx`: one disclosure that composes existing advanced views.
- Modify `src/ui/VaultStewardWorkspace.tsx`: own queue expansion/filter state and compose the workbench.
- Modify `styles.css`: teal semantic system, responsive workbench, compact rows, and stable control dimensions.
- Modify `tests/ui/dashboard.test.tsx`: cover compact/filter helper and source-aware queue behavior.
- Modify `tests/ui/workspace.test.tsx`: cover top-three default, full-queue expansion, repair disclosure, More behavior, and failure preservation.
- Create `tests/ui/more-tools.test.tsx`: cover advanced-tool disclosure and keyboard use.
- Modify `docs/manual-acceptance-suite.md` and `docs/manual-acceptance-checklist.md`: document the revised review flow and visual acceptance checks.
- Modify `README.md`: describe the focused review workbench without roadmap/progress narration.

## Task 1: Define Compact Queue Semantics

**Files:**

- Modify: `src/ui/dashboard.ts`
- Test: `tests/ui/dashboard.test.tsx`

**Interfaces:**

- Consumes: `Finding`, `rankDashboardFindings(findings)`.
- Produces:

  ```ts
  export type FindingQueueFilter = { severity: FindingSeverity | "all"; query: string };
  export function filterDashboardFindings(
    findings: readonly Finding[],
    filter: FindingQueueFilter
  ): Finding[];
  export function compactDashboardFindings(findings: readonly Finding[], limit?: number): Finding[];
  ```

- [ ] **Step 1: Write failing helper tests**

  Add cases proving the compact queue takes the first three already-ranked findings and the filter matches case-insensitive explanation, evidence path, and locator text:

  ```ts
  expect(compactDashboardFindings([critical, high, medium, low])).toEqual([
    critical,
    high,
    medium
  ]);
  expect(
    filterDashboardFindings([critical, medium], { severity: "medium", query: "home" })
  ).map((item) => item.id)).toEqual(["medium"]);
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `npx vitest run tests/ui/dashboard.test.tsx`

  Expected: FAIL because `compactDashboardFindings` and `filterDashboardFindings` are not exported.

- [ ] **Step 3: Implement pure queue helpers**

  Add a 3-item default limit and filter against only user-visible finding fields:

  ```ts
  export function compactDashboardFindings(findings: readonly Finding[], limit = 3): Finding[] {
    return rankDashboardFindings(findings).slice(0, limit);
  }
  ```

  Normalize query with `trim().toLocaleLowerCase()` and return ranked matches. Do not query note contents or persisted history.

- [ ] **Step 4: Run focused and unit tests**

  Run: `npx vitest run tests/ui/dashboard.test.tsx && npm run test:unit`

  Expected: PASS; the existing ranking order remains unchanged.

- [ ] **Step 5: Commit the helper boundary**

  ```bash
  git add src/ui/dashboard.ts tests/ui/dashboard.test.tsx
  git commit -m "feat: add focused finding queue helpers"
  ```

## Task 2: Build Compact, Source-Aware Queue Rows

**Files:**

- Modify: `src/ui/PriorityFindings.tsx`
- Modify: `src/ui/VaultHealthSummary.tsx`
- Test: `tests/ui/dashboard.test.tsx`

**Interfaces:**

- Consumes: `Finding[]`, `FindingQueueFilter`, `compactDashboardFindings`, `filterDashboardFindings`.
- Produces: `PriorityFindings` props with `expanded`, `filter`, `onFilterChange`, and `onToggleExpanded` callbacks.

- [ ] **Step 1: Write failing component tests**

  Add a four-finding render case. Assert that compact mode exposes only three finding buttons and a `View all findings` command. After expanding, assert all four are present and a source path is visible:

  ```tsx
  expect(screen.queryByRole("button", { name: /low finding/i })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View all findings" }));
  expect(screen.getByText("Notes/Low.md")).toBeInTheDocument();
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `npx vitest run tests/ui/dashboard.test.tsx`

  Expected: FAIL because `PriorityFindings` has no compact/full queue controls.

- [ ] **Step 3: Implement the queue and health presentation**

  Render a semantic row with severity text, explanation, first evidence path, and locator. In compact mode, pass the first three ranked findings. In expanded mode, render native severity select and text input with these labels:

  ```tsx
  <select aria-label="Finding severity filter">...</select>
  <input aria-label="Search findings" />
  <button type="button">View all findings</button>
  ```

  Update `VaultHealthSummary` so counts are non-interactive status content rather than visually indistinguishable buttons.

- [ ] **Step 4: Run focused tests and accessibility assertions**

  Run: `npx vitest run tests/ui/dashboard.test.tsx`

  Expected: PASS; selected rows expose `aria-pressed`, filters have labels, and count text remains readable.

- [ ] **Step 5: Commit the queue presentation**

  ```bash
  git add src/ui/PriorityFindings.tsx src/ui/VaultHealthSummary.tsx tests/ui/dashboard.test.tsx
  git commit -m "feat: present a compact source-aware review queue"
  ```

## Task 3: Compose the Review Workbench and Progressive Repair

**Files:**

- Modify: `src/ui/VaultStewardWorkspace.tsx`
- Modify: `src/ui/FindingDetail.tsx`
- Test: `tests/ui/workspace.test.tsx`

**Interfaces:**

- Consumes: queue helpers and existing `createProposal`, `reviewProposal`, and `applyProposal` callbacks.
- Produces: workspace state `queueExpanded`, `queueFilter`, and `repairSetupOpen`.

- [ ] **Step 1: Write failing workspace tests**

  Add a four-finding render test that confirms the default surface has three queue rows and a selected detail. Add a repair test that confirms `Reference target` is absent until `Review repair` is clicked:

  ```tsx
  expect(screen.queryByLabelText("Reference target")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review repair" }));
  expect(screen.getByLabelText("Reference target")).toBeInTheDocument();
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `npx vitest run tests/ui/workspace.test.tsx`

  Expected: FAIL because repair controls appear immediately and the queue has no compact state.

- [ ] **Step 3: Implement workbench state and repair disclosure**

  Add state:

  ```ts
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [queueFilter, setQueueFilter] = useState<FindingQueueFilter>({
    severity: "all",
    query: ""
  });
  const [repairSetupOpen, setRepairSetupOpen] = useState(false);
  ```

  Reset `repairSetupOpen` when `selectedFinding.id` changes. Render one `Review repair` button for eligible broken references. Reveal the existing target input and `Prepare reference repair` only after that explicit click. Keep proposal, approval, apply, and stale handling unchanged.

- [ ] **Step 4: Run focused UI and E2E coverage**

  Run: `npx vitest run tests/ui/workspace.test.tsx tests/e2e/review-apply.test.ts`

  Expected: PASS; selecting a finding cannot write, and repair creation still uses the selected finding ID.

- [ ] **Step 5: Commit the review workbench behavior**

  ```bash
  git add src/ui/VaultStewardWorkspace.tsx src/ui/FindingDetail.tsx tests/ui/workspace.test.tsx
  git commit -m "feat: add focused review workbench flow"
  ```

## Task 4: Move Advanced Tools Behind More

**Files:**

- Create: `src/ui/MoreTools.tsx`
- Modify: `src/ui/VaultStewardWorkspace.tsx`
- Test: `tests/ui/more-tools.test.tsx`

**Interfaces:**

- Consumes: existing `ModelReadinessView`, `PolicyStudio`, `MaintenanceScheduleView`, `MaintenanceView`, `HistoryView`, and `ObservabilityView` props.
- Produces:

  ```tsx
  export function MoreTools({ children }: { children: ReactNode }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing disclosure test**

  Render `MoreTools` with two named child sections. Assert the native disclosure is closed, keyboard reachable, and reveals its content after activation:

  ```tsx
  expect(screen.getByText("More").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("More"));
  expect(screen.getByText("Model")).toBeInTheDocument();
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `npx vitest run tests/ui/more-tools.test.tsx`

  Expected: FAIL because `MoreTools` does not exist.

- [ ] **Step 3: Create the More boundary and compose existing tools**

  Implement a native disclosure:

  ```tsx
  <details className="more-tools">
    <summary>More</summary>
    <div className="more-tools-content">{children}</div>
  </details>
  ```

  Move only the render location of existing advanced components. Do not change their props, repository calls, storage behavior, or independent tests.

- [ ] **Step 4: Run focused and existing advanced-view tests**

  Run: `npx vitest run tests/ui/more-tools.test.tsx tests/ui/model-readiness.test.tsx tests/ui/maintenance-view.test.tsx tests/ui/observability-view.test.tsx`

  Expected: PASS; advanced tools remain closed until More is opened.

- [ ] **Step 5: Commit the advanced-tool disclosure**

  ```bash
  git add src/ui/MoreTools.tsx src/ui/VaultStewardWorkspace.tsx tests/ui/more-tools.test.tsx
  git commit -m "feat: group advanced workspace tools under more"
  ```

## Task 5: Apply Teal Semantic Styling and Responsive Layout

**Files:**

- Modify: `styles.css`
- Test: `tests/ui/dashboard.test.tsx`
- Test: `tests/ui/workspace.test.tsx`

**Interfaces:**

- Consumes: stable class names from Tasks 2-4: `review-workbench`, `finding-row`, `finding-row-severity-*`, `more-tools`, and `repair-setup`.
- Produces: responsive CSS with desktop two-column layout and narrow single-column stack.

- [ ] **Step 1: Add failing class/semantic tests**

  Assert one medium row includes textual severity and a semantic class, not a color-only indicator:

  ```tsx
  expect(screen.getByText("Medium")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /medium finding/i })).toHaveClass(
    "finding-row-severity-medium"
  );
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `npx vitest run tests/ui/dashboard.test.tsx`

  Expected: FAIL because semantic row classes are absent.

- [ ] **Step 3: Implement the visual system**

  Add CSS custom properties scoped to `.vault-steward-dashboard`:

  ```css
  --steward-accent: #118477;
  --steward-attention: #b87511;
  --steward-low-risk: #3d8064;
  --steward-failure: #ba3b4a;
  ```

  Use Obsidian background/text variables for theme compatibility. Add a stable `grid-template-columns: minmax(220px, .9fr) minmax(280px, 1.4fr)` workbench and a `max-width: 680px` media rule that stacks it. Do not use gradients, decorative orbs, or nested cards.

- [ ] **Step 4: Run UI tests and inspect generated CSS**

  Run: `npx vitest run tests/ui/dashboard.test.tsx tests/ui/workspace.test.tsx && npm run build`

  Expected: PASS; the bundled stylesheet contains the workbench classes and no layout-affecting JavaScript is needed.

- [ ] **Step 5: Commit visual and responsive work**

  ```bash
  git add styles.css tests/ui/dashboard.test.tsx tests/ui/workspace.test.tsx
  git commit -m "style: refine focused review workbench"
  ```

## Task 6: Complete Documentation, Desktop Acceptance, and Release Gate

**Files:**

- Modify: `docs/manual-acceptance-suite.md`
- Modify: `docs/manual-acceptance-checklist.md`
- Modify: `README.md`
- Modify: `task.md`
- Modify: `docs/progress.md`

**Interfaces:**

- Consumes: completed UI behavior from Tasks 1-5.
- Produces: updated manual test instructions and completed Phase 19 tasks only after all verification passes.

- [ ] **Step 1: Update manual acceptance expectations**

  Replace sequential dashboard instructions with this first-run flow:

  ```text
  Run scan -> inspect health -> select one of the top three -> review detail ->
  expand View all findings -> open More only for readiness/policy/maintenance/history/observability.
  ```

  Add checklist assertions for teal selection, non-color severity labels, narrow-pane stacking, More disclosure, queue filtering, and repair setup disclosure.

- [ ] **Step 2: Update README and tracker**

  Describe the workbench as a focused review interface. Do not mention phase numbers or implementation progress in the README. Tick Phase 19 only after every command in Step 3 passes.

- [ ] **Step 3: Run the completion gate**

  Run:

  ```bash
  npm run format:check
  npm run lint
  npm run typecheck
  npm run build
  npm run test:unit
  npm run test:integration
  npm run test:e2e
  npm run test:acceptance
  npm run eval:smoke
  npm run security:check
  npm run test:plugin-install
  ```

  Expected: every command passes. Record any unavailable external audit check explicitly rather than ticking Phase 19.

- [ ] **Step 4: Perform the manual Obsidian acceptance check**

  Package with `npm run package:plugin`, copy `dist/vault-steward/` into the Northstar Acceptance vault, reload the plugin, and verify light/dark themes, a narrow sidebar, keyboard-only queue/detail/More use, failed-provider recovery, safe repair, stale protection, and no clipped controls.

- [ ] **Step 5: Commit, promote, and push the completed phase**

  ```bash
  git add README.md docs/manual-acceptance-suite.md docs/manual-acceptance-checklist.md docs/progress.md task.md
  git commit -m "docs: complete focused review workbench acceptance"
  git switch development
  git merge --ff-only feat/phase-19-focused-review-workbench
  git push origin development
  ```

## Plan Self-Review

- Spec coverage: Tasks 1-3 implement top-three queue, filters, selected detail, progressive repair, and safety preservation. Task 4 implements More. Task 5 implements teal semantic visuals and responsive layout. Task 6 covers documentation, manual acceptance, and the completion gate.
- Placeholder scan: no unresolved markers or deferred implementation phrases are present.
- Type consistency: `FindingQueueFilter`, queue helper names, workbench class names, and `MoreTools` are defined before later tasks consume them.
