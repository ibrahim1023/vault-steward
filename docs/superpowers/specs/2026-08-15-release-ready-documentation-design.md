# Release-Ready Documentation Design

## Goal

Make Vault Steward ready for an Obsidian Community Plugin submission review
without overstating marketplace availability, model quality, platform support,
or automated authority.

## Scope

This documentation pass covers the public README, privacy and security
disclosures, release compatibility, known limitations, the community-plugin
submission checklist, release-readiness guidance, and the tests that protect
public documentation claims.

It does not change plugin behavior, add a support service, claim that a
marketplace submission has occurred, or create screenshots or a demonstration
video. Those release-owner materials remain explicit checklist items.

## Public Documentation Structure

The README becomes the user-facing entry point. It will lead with the product
value and the simple workflow: select a provider, check a vault, review an
exact recommendation, and explicitly apply only the selected changes.

It will retain a concise explanation of coordinated review: deterministic
scanner and integrity checks, bounded semantic reviewers, a repair planner,
and an approval/apply guard have distinct roles. Models assist review but do
not write notes, approve work, or expand their own authority.

Provider, privacy, installation, and troubleshooting information will remain
in the README at an operational level. Detailed evaluation commands,
benchmark mechanics, internal architecture, and engineering runbooks will be
linked rather than presented as first-run instructions.

## Trust and Release Records

Trust documents must agree on these facts:

- Ollama and llama.cpp-compatible endpoints are local, loopback-only paths.
- HyperFusion and OpenAI are experimental, opt-in, fixed-origin cloud
  providers that require an API key and provider-specific acknowledgement.
- Cloud use sends bounded selected evidence and prompts only; it never grants
  automatic note-edit authority.
- macOS is the validated desktop platform. Windows and Linux remain
  unvalidated.
- The completed deep-security scan and its two remediated low-severity
  findings are recorded accurately; no document may say that the scan was
  unavailable or blocked.
- Phase 31 policy fail-closed and conditional rollback protections are
  reflected in security and release guidance.

The submission checklist will distinguish verified repository evidence from
remaining release-owner work: public repository and license confirmation,
version/tag/changelog alignment, release-go quality decision, screenshots,
demonstration, and any final platform evidence.

## New Release-Readiness Guide

Add a short guide that gathers the final submission evidence in one place:

1. Build and package contents.
2. Automated release gate and dependency audit.
3. Required manual desktop evidence.
4. Marketplace materials and truthful product claims.
5. Final owner sign-off before an upstream submission.

The guide is a release procedure, not a claim that the plugin is already
available in the Obsidian community marketplace.

## Verification

Update the existing public-documentation tests to require the new
release-readiness guide and to reject stale statements. Run documentation
tests, format, lint, typecheck, the relevant unit suite, and link/path checks
provided by the current test suite.

## Acceptance Criteria

- A new user can understand the product, install it manually, choose a
  provider, and safely start a review from the README.
- A reviewer can find privacy, security, limitations, upgrade, troubleshooting,
  release-compatibility, and release-readiness guidance from the README.
- Public documents agree about provider status, approval boundaries, macOS
  validation, completed security work, and remaining submission work.
- No document implies autonomous editing, marketplace availability, or
  unsupported validation.
