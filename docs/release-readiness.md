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
npm run eval:smoke
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

Prepare current screenshots as release-owner materials. A short
scan-to-approval demonstration is useful for promotion but is not required for
Community Plugins submission. Check that public descriptions accurately state
the local-first provider path, experimental cloud-provider boundaries, and the
absence of automatic note editing.

## Publish the release

The release workflow is the only supported publication path. After version,
manifest, `versions.json`, and changelog alignment have been verified, create
and push the matching numeric tag (for example, `0.2.0`). GitHub Actions runs
the release gate, packages exactly `main.js`, `manifest.json`, and `styles.css`,
attests the executable assets, and creates the GitHub release. Do not create a
manual release for an attested version.

## Release owner sign-off

The release owner confirms the automated gate, package contents, macOS desktop
evidence, screenshots, public repository and license, version/tag/changelog
alignment, and the successful attested GitHub workflow. Upstream submission is
a separate owner action and must occur only after this sign-off.
