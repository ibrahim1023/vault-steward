# Community Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a `0.1.1` release that resolves every actionable Obsidian Community scorecard finding while keeping Vault Steward’s deliberate local-first review model intact.

**Architecture:** Keep the plugin’s existing deterministic core and approval guard unchanged. Replace browser-global transport defaults with an Obsidian request transport boundary, use the browser-specific SQLite runtime in the production bundle, and align manifest, lifecycle, UI, package, and release contracts with Obsidian’s published guidance.

**Tech Stack:** TypeScript, Obsidian Plugin API, React, esbuild, Vitest, sql.js.

**Spec:** `spec.md`, `docs/interfaces.md`, `docs/security.md`, and the live Community scorecard at `https://community.obsidian.md/plugins/vault-steward#scorecard`.

## Global Constraints

- Release version is exactly `0.1.1`; `versions.json` maps it to `1.7.2`.
- `manifest.json` contains only supported plugin manifest fields and its description does not contain `Obsidian`.
- `main.js`, `manifest.json`, and optional `styles.css` are the only GitHub release assets; internal `release-manifest.json` remains package-local.
- Ollama and llama.cpp remain loopback-only; OpenAI and HyperFusion remain fixed-origin, opt-in, and acknowledgement-gated.
- The plugin keeps read/write/enumeration capabilities because they are required for user-approved vault review; those are documented disclosures, not removed behavior.
- Production code is covered by failing-then-passing tests for each behavior change.

---

### Task 1: Manifest and public command compatibility

**Files:**
- Modify: `manifest.json`, `versions.json`, `tests/plugin/manifest.test.ts`
- Modify: `src/plugin/commands.ts`, `tests/plugin/commands.test.ts`

**Interfaces:**
- Produces a valid Obsidian manifest with `version: "0.1.1"`, `minAppVersion: "1.7.2"`, and no `main` field.
- Produces the command label `Open status` while retaining command id `open-status`.

- [ ] **Step 1: Write failing contract assertions**

```ts
expect(manifest).not.toHaveProperty("main");
expect(manifest).toMatchObject({ version: "0.1.1", minAppVersion: "1.7.2" });
expect(manifest.description).not.toMatch(/Obsidian/i);
expect(command.name).toBe("Open status");
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run tests/plugin/manifest.test.ts tests/plugin/commands.test.ts`

Expected: assertions fail against `0.1.0`, `1.5.0`, `main`, and `Open Vault Steward status`.

- [ ] **Step 3: Make the smallest metadata and command edits**

```json
{ "version": "0.1.1", "minAppVersion": "1.7.2", "description": "Local-first, evidence-backed vault maintenance." }
```

```ts
name: "Open status"
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run tests/plugin/manifest.test.ts tests/plugin/commands.test.ts`

Expected: all assertions pass.

### Task 2: Obsidian lifecycle and settings UI compliance

**Files:**
- Modify: `src/main.ts`, `tests/ui/workspace.test.tsx` or a new focused plugin lifecycle test

**Interfaces:**
- `onunload()` returns `void`, never detaches user-positioned leaves, closes an initialized database safely.
- `openStatusView()` awaits `workspace.revealLeaf(leaf)`.
- Settings display uses `new Setting(containerEl).setName(...).setHeading()` or has no redundant title element.

- [ ] **Step 1: Write failing lifecycle and UI assertions**

```ts
expect(source).not.toContain("detachLeavesOfType");
expect(source).toContain("await this.app.workspace.revealLeaf(leaf)");
expect(source).not.toContain('createEl("h2", { text: "Vault Steward settings" })');
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/plugin/main-lifecycle.test.ts`

Expected: source contract fails on current lifecycle, non-awaited reveal, and manual heading.

- [ ] **Step 3: Implement the smallest lifecycle-safe behavior**

```ts
onunload(): void {
  const database = this.database;
  this.database = undefined;
  if (database) void database.flush().finally(() => database.close());
}
```

Remove leaf detachment, await leaf reveal, and replace the title with a supported heading or no title.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run tests/plugin/main-lifecycle.test.ts`

Expected: all source-level behavioral contracts pass.

### Task 3: Obsidian-native model transport and timer compatibility

**Files:**
- Modify: `src/model-provider/local-provider.ts`, model-provider tests, `tests/security/hardening.test.ts`, and provider integration tests as needed

**Interfaces:**
- Introduce `ProviderRequester`, which accepts `{ url, method, headers, body }` and returns `{ status, text }`.
- The production default uses Obsidian `requestUrl`; tests inject `ProviderRequester` stubs.
- `window.setTimeout` and `window.clearTimeout` own provider deadlines.
- All local and cloud endpoint validation, bounded response checking, timeout, and cancellation failure messages remain unchanged.

- [ ] **Step 1: Write failing requester tests**

```ts
const requester = vi.fn().mockResolvedValue({ status: 200, text: '{"response":"{}"}' });
await createLocalProvider(config, requester).generate({ prompt: "x", maxOutputTokens: 5 });
expect(requester).toHaveBeenCalledWith(expect.objectContaining({ method: "POST" }));
```

- [ ] **Step 2: Run model-provider tests and confirm RED**

Run: `npx vitest run tests/model-provider/local-provider.test.ts tests/model-provider/openai-provider.test.ts tests/model-provider/hyperfusion-provider.test.ts`

Expected: injected requester shape is unsupported by current fetch-based implementation.

- [ ] **Step 3: Implement `requestUrl` adapter and preserve bounds**

```ts
const defaultRequester: ProviderRequester = async ({ url, method, headers, body }) => {
  const response = await requestUrl({ url, method, headers, body, throw: false });
  return { status: response.status, text: response.text };
};
```

Use byte-length checks on returned text before JSON parsing, retain no-redirect fixed-origin/loopback validation at configuration time, and use `window` timers.

- [ ] **Step 4: Run provider and security tests and confirm GREEN**

Run: `npx vitest run tests/model-provider tests/security/hardening.test.ts tests/privacy/offline-acceptance.test.ts`

Expected: provider behavior and safety regression assertions pass without global `fetch` calls.

### Task 4: Bundle and package remediation

**Files:**
- Modify: `src/storage/sqlite-runtime.ts`, `esbuild.config.mjs`, `scripts/package-plugin.ts`
- Modify: `src/packaging/install.ts`, `src/packaging/release-manifest.ts`, `src/release/compatibility.ts`
- Modify: `tests/storage/sqlite-runtime.test.ts`, `tests/packaging/*.test.ts`, `tests/release/compatibility.test.ts`

**Interfaces:**
- Production imports `sql.js/dist/sql-wasm-browser.js` and embeds `sql-wasm-browser.wasm`.
- Production build defines `process.env.NODE_ENV` as `production` and minifies `main.js`.
- Internal package test can retain `release-manifest.json`; public GitHub release asset set is exactly `main.js`, `manifest.json`, and `styles.css`.

- [ ] **Step 1: Write failing artifact and browser-runtime tests**

```ts
expect(requiredReleaseAssets()).toEqual(["main.js", "manifest.json", "styles.css"]);
expect(await builtMainJs()).not.toContain('require("node:fs")');
```

- [ ] **Step 2: Run packaging/runtime tests and confirm RED**

Run: `npx vitest run tests/storage/sqlite-runtime.test.ts tests/packaging tests/release/compatibility.test.ts`

Expected: old package contract includes `release-manifest.json` and browser-specific bundle assertion fails.

- [ ] **Step 3: Implement browser runtime and split package/public asset contracts**

Keep the embedded binary path; replace sql.js’s Node-capable entry point with its browser entry point. Make the release helper expose the three public attachments while package/install smoke can still verify the internal hash record.

- [ ] **Step 4: Run package smoke and confirm GREEN**

Run: `npm run build && npm run test:plugin-install`

Expected: plugin package installs, embeds SQLite bytes, has no `node:fs` fallback in `main.js`, and exposes only standard Community Plugin release attachments.

### Task 5: Strict type warning remediation and release documentation

**Files:**
- Modify: `src/contracts/trace.ts`, `src/storage/repositories.ts`, cited source files from scorecard
- Modify: `README.md`, `CHANGELOG.md`, `docs/community-plugin-submission-checklist.md`, `docs/release-compatibility.md`, `docs/upgrade-notes.md`, `docs/progress.md`
- Test: `tests/contracts`, `tests/storage`, and a new source-scorecard regression test

**Interfaces:**
- Runtime validators narrow unknown JSON with object guards before property access.
- Repository deserializers return only validated record values.
- Public docs disclose vault reads/writes/enumeration, bounded provider networking, and embedded WASM.
- `0.1.1` changelog separates corrected review items from intentionally retained capabilities.

- [ ] **Step 1: Write failing type-safety regression cases**

```ts
expect(validateTraceExport({ timeline: [{ attributes: null }] })).toBe(false);
expect(readMetadata('[]')).toBeNull();
```

- [ ] **Step 2: Run focused contracts/storage tests and confirm RED**

Run: `npx vitest run tests/contracts tests/storage`

Expected: new malformed values reveal the unsafe-narrowing boundary before the repair.

- [ ] **Step 3: Implement explicit object/record guards and remove redundant assertions**

Use `isRecord(value): value is Record<string, unknown>` before reading members; replace assertion-only casts with validated local values.

- [ ] **Step 4: Update evidence and run focused checks**

Run: `npm run lint && npx vitest run tests/contracts tests/storage tests/docs`

Expected: no actionable source lint issues and all focused tests pass.

### Task 6: Completion gate and 0.1.1 release preparation

**Files:**
- Modify: release documents only if verification evidence changes

- [ ] **Step 1: Run the full completion gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:acceptance && npm run test:coverage && npm run eval:smoke && npm run eval:full && npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json && npm run test:plugin-install && npm run security:check`

- [ ] **Step 2: Inspect the release directory and public attachment set**

Run: `ls -lh dist/vault-steward && rg -n 'node:fs|createElement\("script"' main.js`

Expected: package contains `main.js`, `manifest.json`, `styles.css`, and internal `release-manifest.json`; public release helper selects only the first three; bundled Node fs fallback is absent.

- [ ] **Step 3: Recheck the Community scorecard after `0.1.1` is published**

Expected: intentional disclosures remain; actionable risks/warnings are removed or have a documented upstream limitation.

