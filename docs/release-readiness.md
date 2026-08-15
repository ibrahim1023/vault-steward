# Release Readiness

## What this guide is for

Use this guide to collect evidence for a release candidate. It does not claim
marketplace availability. Upstream submission is a separate owner action.

## Build the installable plugin

Create the installable artifact with:

```bash
npm run package:plugin
npm run test:plugin-install
```

Confirm that the package is `dist/vault-steward/` and contains the expected
release files before testing it in Obsidian.

## Run the automated gate

Run the release checks from a clean working tree:

```bash
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

Record the command results with the release candidate. Investigate and resolve
any failure before asking for release approval.

## Collect desktop evidence

macOS desktop evidence is required for a release candidate. Windows and Linux
are unvalidated and must not be presented as supported release platforms.

In Obsidian desktop, capture the current check-to-result workflow, including an
exact preview, explicit approval, stale-proposal protection, and the actual
result after an approved apply. Include policy failure and recovery-required
behavior where applicable.

## Prepare marketplace materials

Prepare current screenshots and a scan-to-approval demonstration as
release-owner materials. Check that public descriptions accurately state the
local-first provider path, experimental cloud-provider boundaries, and the
absence of automatic note editing.

## Release owner sign-off

The release owner confirms the automated gate, package contents, macOS desktop
evidence, screenshots, demonstration, public repository and license, and
version/tag/changelog alignment. Before a public release, the release owner
also records a security-assurance risk disposition for the unvalidated
persisted-finding hydration gap, or requires its remediation and focused
regression coverage. Upstream submission is a separate owner action and must
occur only after this sign-off.
