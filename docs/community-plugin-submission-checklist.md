# Community Plugins Submission Checklist

This checklist prepares a release candidate. It stops before upstream
submission and must not be used to claim marketplace availability.

## Repository And Package

- [ ] Repository is public and has a clear license.
- [ ] `manifest.json`, package version, release tag, and changelog agree.
- [x] `npm run test:plugin-install` passes from the Phase 19 worktree.
- [x] Release artifact contains `main.js`, `manifest.json`, `styles.css`,
      `sql-wasm.wasm`, and `release-manifest.json`.
- [ ] Upgrade and uninstall guidance is current.

## Product Evidence

- [x] Current macOS manual acceptance is signed off. (2026-08-05.)
- [x] Northstar Ollama report passes with `qwen3:8b`.
- [x] Northstar OpenAI report passes with explicit acknowledgement. (2026-08-05: `gpt-4o-mini`.)
- [x] `npm run eval:marketplace:gate` passes against one corpus fingerprint. (2026-08-05.)
- [x] Full automated completion gate and production dependency audit pass.
- [ ] Release quality report records a **go** decision.

## Marketplace Materials

- [ ] README describes current behavior without phase or marketplace claims.
- [ ] Stable macOS screenshots show check, exact preview, approval, and result.
- [ ] A short Northstar demonstration shows scan to review to approval.
- [ ] Every visible count, label, provider claim, and repair result is verified.
- [ ] Manual installation and provider-specific troubleshooting are current.
- [ ] macOS is identified as validated; Windows and Linux remain unverified.

## Trust And Disclosure

- [ ] Local-first Ollama default is explicit.
- [ ] OpenAI is opt-in and the bounded-data disclosure is explicit.
- [ ] No automatic-edit claim appears.
- [ ] Exact preview, explicit approval, stale protection, and rollback behavior
      are documented accurately.
- [ ] Privacy, security, known limitations, and data-deletion guidance are linked.
- [ ] No API key, vault excerpt, customer content, or absolute local path appears
      in artifacts, reports, screenshots, or release notes.

## Stop Point

- [ ] All required items above are complete.
- [ ] Release owner has reviewed the final quality report.
- [ ] Upstream Community Plugins submission has not been made by this task.
