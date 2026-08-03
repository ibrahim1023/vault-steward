# Acceptance Vault

Create a test vault with a valid target note, a broken wiki link, an overdue task, a decision without rationale, and a project without an owner. Configure a local model, install the packaged plugin, run a scan, review the evidence, preview and save a policy, check model readiness, inspect maintenance impact, and verify no note changes occur without an approved proposal.

For a larger synthetic workspace, open `fixtures/complex-acceptance-vault/` as
its own disposable Obsidian vault. Its README lists the deliberately injected
safe-repair, review-only, task, decision, duplicate-entity, policy-template,
and semantic-evidence cases. It is separate from the compact Northstar release
fixture and should not be used to change marketplace quality claims.

Use [the complex acceptance vault guide](complex-acceptance-vault.md) to map
each content-driven manual acceptance scenario to its source notes. Installation,
provider recovery, layouts, themes, keyboard navigation, VoiceOver, history,
and diagnostics remain app-level checks and must still be performed in Obsidian.
