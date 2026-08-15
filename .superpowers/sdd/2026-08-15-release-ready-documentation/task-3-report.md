# Task 3 Report: User-Facing Release Guidance

## Implementation

- Reworked `README.md` into the required first-use sequence: select a provider,
  use **Check vault**, inspect the exact **Current**/**After** preview, and
  explicitly use **Apply fixes** only for selected changes.
- Kept provider claims bounded: Ollama is local-first; HyperFusion and OpenAI
  remain experimental opt-in providers requiring a per-provider API key and
  acknowledgement. The README does not claim broad release availability.
- Added the requested README links to release readiness, troubleshooting,
  upgrade notes, release compatibility, privacy, security, and limitations;
  linked docs are protected by the public-documentation test.
- Clarified provider-specific cloud acknowledgement and that deleting retained
  diagnostic traces does not modify vault notes or approval history.
- Added concise private-reporting, fail-closed policy/rollback, threat-model,
  custom-policy recovery, and interrupted-apply recovery guidance.

## Verification

- `npx vitest run tests/docs/public-documentation.test.ts` — passed: 1 test
  file, 4 tests.
- `npm run format:check` — passed.
- `git diff --check` — passed.

The initial repository-wide format check reported only the known formatting
issue in `docs/superpowers/plans/2026-08-15-release-ready-documentation.md`.
Applied its mechanical Prettier-required blank-line changes, then reran the
full command successfully.

## Self-Review

- Confirmed README heading names and order match the Task 3 brief.
- Confirmed no README text contains `Community Plugins` or `Obsidian
  marketplace`.
- Confirmed current HyperFusion wording reflects completed macOS evidence while
  retaining experimental, opt-in, per-provider acknowledgement/API-key limits.
- Confirmed no runtime code changed.

## Commit

`docs: refine release support documentation`
