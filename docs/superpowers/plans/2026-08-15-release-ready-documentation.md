# Release-Ready Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a concise, truthful, submission-ready documentation set for Vault Steward without implying marketplace availability or autonomous editing.

**Architecture:** Keep `README.md` as the user-facing entry point and link to focused trust, support, and release documents. Keep release evidence and release-owner actions in dedicated documents so public product guidance does not become an internal engineering manual. Protect material public claims with the existing Vitest documentation suite.

**Tech Stack:** Markdown, Vitest, Node.js 20+, Prettier, ESLint, TypeScript project checks.

## Global Constraints

- Obsidian desktop 1.5.0+ is the supported product floor; macOS is the only validated desktop platform.
- Ollama and llama.cpp-compatible providers remain local, loopback-only paths.
- HyperFusion and OpenAI remain experimental, opt-in, fixed-origin cloud providers requiring a provider-specific acknowledgement and API key.
- No document may claim marketplace availability, automatic editing, universal model quality, Windows/Linux validation, or an unfinished deep-security scan.
- The plugin never edits a note without an exact preview, explicit approval, and current-revision validation.
- Do not add dependencies or change plugin runtime behavior in this documentation pass.

---

### Task 1: Lock release claims with public-documentation tests

**Files:**
- Modify: `tests/docs/public-documentation.test.ts`
- Test: `tests/docs/public-documentation.test.ts`

**Interfaces:**
- Consumes: repository-root Markdown through `readFileSync` and the public-documentation test convention.
- Produces: executable guarantees for the release-readiness guide, current security status, bounded provider claims, and removed Policy Studio UI claims.

- [ ] **Step 1: Write failing documentation assertions**

Add `docs/release-readiness.md` to `requiredPublicDocs`. Add a focused test that reads the named documents and asserts the public contract rather than implementation wording:

```ts
it("keeps release readiness and security status current", () => {
  const readiness = readFileSync(resolve(root, "docs/release-readiness.md"), "utf8");
  const security = readFileSync(resolve(root, "docs/security.md"), "utf8");
  const compatibility = readFileSync(resolve(root, "docs/release-compatibility.md"), "utf8");
  const upgrade = readFileSync(resolve(root, "docs/upgrade-notes.md"), "utf8");

  expect(readiness).toContain("Release owner sign-off");
  expect(readiness).toContain("Upstream submission is a separate owner action");
  expect(security).toContain("completed deep-security scan");
  expect(security).not.toContain("could not create a new report");
  expect(compatibility).toContain("HyperFusion and OpenAI are experimental");
  expect(upgrade).not.toContain("Policy Studio stores");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx vitest run tests/docs/public-documentation.test.ts
```

Expected: FAIL because `docs/release-readiness.md` is absent and the existing documents retain superseded deep-scan, provider, and Policy Studio wording.

- [ ] **Step 3: Leave the test unchanged until the documentation tasks satisfy it**

Do not weaken the assertions or change implementation code. The new guide and corrected records in Tasks 2 and 3 are the intended production changes.

- [ ] **Step 4: Re-run the focused test after Tasks 2 and 3**

Run:

```bash
npx vitest run tests/docs/public-documentation.test.ts
```

Expected: PASS with every public documentation claim checked against the updated files.

- [ ] **Step 5: Commit the test contract with the documentation changes**

```bash
git add tests/docs/public-documentation.test.ts README.md PRIVACY.md SECURITY.md docs/
git commit -m "docs: prepare production release guidance"
```

### Task 2: Create the release-readiness guide and correct release records

**Files:**
- Create: `docs/release-readiness.md`
- Modify: `docs/community-plugin-submission-checklist.md`
- Modify: `docs/release-compatibility.md`
- Modify: `docs/security.md`
- Modify: `docs/known-limitations.md`
- Modify: `docs/upgrade-notes.md`
- Test: `tests/docs/public-documentation.test.ts`

**Interfaces:**
- Consumes: the approved design in `docs/superpowers/specs/2026-08-15-release-ready-documentation-design.md`, release scripts in `package.json`, and verified Phase 30/31 evidence.
- Produces: a single owner-facing release procedure and mutually consistent public release, security, limitation, and upgrade claims.

- [ ] **Step 1: Write `docs/release-readiness.md`**

Use these headings and keep each section action-oriented:

```md
# Release Readiness

## What this guide is for
## Build the installable plugin
## Run the automated gate
## Collect desktop evidence
## Prepare marketplace materials
## Release owner sign-off
```

Document these exact commands where relevant:

```bash
npm run package:plugin
npm run test:plugin-install
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:acceptance
npm run build
npm run security:check
```

State that the package is `dist/vault-steward/`, macOS desktop evidence is required, Windows/Linux are unvalidated, screenshots and a scan-to-approval demonstration are release-owner materials, and upstream submission is a separate owner action.

- [ ] **Step 2: Make the submission checklist an auditable release gate**

Preserve verified dates only where they reflect completed evidence. Mark Phase 31 policy failure/recovery retest and the completed deep-security scan as verified. Keep unchecked only genuine owner actions: public repository/license confirmation, version/tag/changelog alignment, current screenshots, demonstration, final release-quality go decision, and upstream submission restraint.

Replace phase-oriented assertions with user-visible evidence, such as exact preview, explicit approval, stale protection, fail-closed policy handling, and recovery-required behavior.

- [ ] **Step 3: Correct security, compatibility, and limitations statements**

In `docs/security.md`, replace the obsolete external-scan blockage paragraph with a compact record: the completed deep-security scan identified two low-severity findings, both were remediated by fail-closed policy loading and conditional rollback, and regression coverage protects both paths.

In `docs/release-compatibility.md`, state that Ollama is the local-first release path and that HyperFusion and OpenAI have completed current macOS manual/provider evidence but remain experimental opt-in providers. Keep the explicit statement that only macOS is validated.

In `docs/known-limitations.md`, retain the meaningful migration, model-quality, scope, and sync limits, while replacing stale marketplace and provider-evidence wording with the current remaining release-owner actions.

- [ ] **Step 4: Correct the upgrade guide**

Keep install, upgrade, rollback-safe preparation, and uninstall instructions. Replace the obsolete visible Policy Studio save workflow with: an existing `.vault-steward/policy.yaml` remains supported for deterministic policy checks; a missing policy uses a starter default; invalid, unreadable, or oversized existing policy files stop a scan until restored or removed.

- [ ] **Step 5: Run the focused documentation test**

Run:

```bash
npx vitest run tests/docs/public-documentation.test.ts
```

Expected: PASS for release-readiness existence, completed security evidence, provider boundaries, and removed Policy Studio UI claim.

### Task 3: Refine user-facing README, privacy, security, and troubleshooting guidance

**Files:**
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `SECURITY.md`
- Modify: `docs/troubleshooting.md`
- Modify: `tests/docs/public-documentation.test.ts`
- Test: `tests/docs/public-documentation.test.ts`

**Interfaces:**
- Consumes: the release-readiness guide from Task 2 and the stable product/provider facts in the approved design.
- Produces: a user-first README with linked detailed guidance and support documents that agree on privacy, provider acknowledgement, policy recovery, and safe approval boundaries.

- [ ] **Step 1: Restructure README around first use**

Keep these concise sections in this order:

```md
# Vault Steward
## Keep your vault trustworthy
## The simple flow
## What Vault Steward checks
## Coordinated review, not autonomous editing
## Choose a model provider
## Privacy and safety
## Install and get started
## Limitations
## Documentation
## Development
```

The first-use flow must be: choose a provider, use **Check vault**, review the exact **Current** and **After** preview, then explicitly use **Apply fixes** for selected changes. Link detailed evaluation material instead of listing marketplace-evaluation command invocations in the main product narrative.

Add links to `docs/release-readiness.md`, `docs/troubleshooting.md`, `docs/upgrade-notes.md`, `docs/release-compatibility.md`, `PRIVACY.md`, `SECURITY.md`, and `docs/known-limitations.md`.

- [ ] **Step 2: Tighten privacy and security disclosures**

In `PRIVACY.md`, make provider-specific acknowledgement explicit: OpenAI acknowledgement never authorizes HyperFusion and vice versa. State that removing retained diagnostic traces does not modify vault notes or approval history.

In `SECURITY.md`, keep the private-reporting route language, clarify that policy and rollback failures fail closed, and link `docs/security.md` for the full threat model without copying internal scan mechanics into the public overview.

- [ ] **Step 3: Improve operator troubleshooting**

Add two concise troubleshooting sections:

```md
## Custom Policy File Error
## Failed or Interrupted Apply
```

The policy section must identify `.vault-steward/policy.yaml`, explain restoring/removing an invalid, unreadable, or oversized existing file, and tell the user to run **Check vault** again. The apply section must explain that concurrent edits are preserved, a recovery-required status needs review/re-indexing, and a fresh preview/approval is required before retrying.

- [ ] **Step 4: Verify documentation links and bounded claims**

Extend `requiredPublicDocs` and public-documentation assertions only for documents linked from the README. Run:

```bash
npx vitest run tests/docs/public-documentation.test.ts
npm run format:check
```

Expected: PASS, with every linked document present and all Markdown formatted.

### Task 4: Run the final documentation completion gate

**Files:**
- Modify: `README.md`, `PRIVACY.md`, `SECURITY.md`, `docs/*.md`, `tests/docs/public-documentation.test.ts`
- Test: `tests/docs/public-documentation.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a verified public documentation bundle ready for release-owner review.

- [ ] **Step 1: Inspect the complete diff for claim drift and unsafe promises**

Run:

```bash
git diff --check
git diff -- README.md PRIVACY.md SECURITY.md docs/ tests/docs/public-documentation.test.ts
```

Confirm all changes are documentation or documentation-test changes; confirm no API key, vault excerpt, absolute local path, marketplace-availability claim, autonomous-edit claim, or unvalidated-platform claim appears.

- [ ] **Step 2: Run the relevant quality gate**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npx vitest run tests/docs/public-documentation.test.ts
npm run test:unit
```

Expected: all commands exit zero.

- [ ] **Step 3: Commit the documentation pass**

Run:

```bash
git add README.md PRIVACY.md SECURITY.md docs/ tests/docs/public-documentation.test.ts
git commit -m "docs: prepare release-ready product guidance"
```

## Self-Review

- Spec coverage: Task 1 protects claims, Task 2 creates and aligns release records, Task 3 improves the user and trust surfaces, and Task 4 verifies the complete bundle.
- No placeholders: every task names exact files, headings, factual claims, commands, tests, and expected outcomes.
- Consistency: every task uses the same provider, approval, platform, and security facts defined in the global constraints.
