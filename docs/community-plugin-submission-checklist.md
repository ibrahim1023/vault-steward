# Community Plugins Submission Checklist

This checklist prepares a release candidate. It stops before upstream
submission and must not be used to claim marketplace availability.

## Repository And Package

- [x] Repository is public and uses the MIT License. (2026-08-18.)
- [x] `manifest.json`, `versions.json`, package version, `0.1.0` release tag,
      and changelog agree.
      (2026-08-18.)
- [x] `npm run test:plugin-install` passes for the release package. (2026-08-18.)
- [x] Release artifact contains `main.js`, `manifest.json`, `styles.css`,
      `sql-wasm.wasm`, and `release-manifest.json`.
- [x] Upgrade and uninstall guidance describes the current package and recovery path.

## Product Evidence

- [x] macOS desktop acceptance covers the exact preview, explicit approval,
      stale protection, and actual post-apply result. (2026-08-12.)
- [x] Northstar Ollama report passes with `qwen3:8b`.
- [x] Northstar OpenAI report passes with explicit acknowledgement. (2026-08-05: `gpt-4o-mini`.)
- [x] `npm run eval:marketplace:gate` passes against one corpus fingerprint. (2026-08-05.)
- [x] Full automated completion gate and production dependency audit pass.
      (2026-08-12: 402 tests; integration, E2E, acceptance, evaluations, and
      package-install smoke passed; production audit found 0 vulnerabilities.)
- [x] Policy loading fails closed for invalid, unreadable, or oversized existing
      files, and failed writes preserve concurrent edits or require recovery.
      (2026-08-15.)
- [x] The completed deep-security scan found two low-severity findings; both
      have fail-closed policy-loading and conditional-rollback remediations
      with regression coverage. (2026-08-15.)
- [ ] Release quality report records a **go** decision.

## Marketplace Materials

- [x] Public documentation describes current behavior without phase or marketplace claims.
- [ ] Stable macOS screenshots show check, exact preview, approval, and result.
- [ ] A short Northstar demonstration shows scan to review to approval.
- [x] Visible counts, labels, provider claims, and repair results have been verified.
- [x] Manual installation and provider-specific troubleshooting are current.
- [x] macOS is identified as validated; Windows and Linux remain unvalidated.

## Trust And Disclosure

- [x] Local-first Ollama is explicit.
- [x] HyperFusion and OpenAI are experimental opt-in providers with bounded-data disclosures.
- [x] No automatic-edit claim appears.
- [x] Exact preview, explicit approval, stale protection, fail-closed policy
      handling, and recovery-required behavior are documented accurately.
- [x] Privacy, security, known limitations, and data-deletion guidance are linked.
- [x] No API key, vault excerpt, customer content, or absolute local path appears
      in artifacts, reports, screenshots, or release notes.

## Stop Point

- [ ] Upstream Community Plugins submission has not been made by this task.
