# Northstar Release Workflow

## Purpose

Northstar is the single release persona and reference workflow for the first
Community Plugins release candidate. It represents a product and project team
maintaining a launch brief, decisions, delivery tasks, dependencies, partner
plans, research, and a retrospective. The source vault is
`fixtures/desktop-acceptance-vault/`.

This workflow proves one coherent product loop. It does not claim four-persona
coverage or generalize results beyond the reviewed fixture.

## First Run

1. Install the packaged plugin into a fresh copy of the Northstar vault.
2. Open Vault Steward from the ribbon.
3. Open **Settings**, select Ollama, and configure a tested local model.
4. Return to the workspace and select **Check vault**.
5. Confirm one progress state appears and the previous successful result, when
   present, remains visible.

Expected result: setup is understandable without opening Diagnostics, provider
failure is actionable, and no finding is reported as completed when the required
model stage fails.

## Scan And Review

After a completed scan, Vault Steward presents the highest-value action rather
than a health dashboard. A safe repair shows exact **Current**, **After**, and
**Expected result** sections. A judgment-only finding shows one explanation and
one concrete action. **View all issues** is secondary.

The release corpus covers project ownership, decision rationale, valid and
invalid references, missing anchors and embeds, overdue/orphaned/duplicate/
abandoned/malformed tasks, hard negatives, and semantic abstentions.

## Repair And Approval

The reference in `Work/Partner Enablement.md` is the release repair:

```text
Current: [[Guides/Partner Migration Checklist]]
After:   [[Guides/Partner Onboarding Checklist]]
```

The selected provider may rank only the listed existing snapshot target or
abstain. Deterministic code validates the candidate, constructs the patch,
calculates the expected outcome, checks all proposal digests and source
revisions, records approval, and applies the write. The model never supplies
patch ranges or approval.

## Rejection

Select **Not important** on a judgment-only finding. The item must be suppressed
for the current review flow and the next issue must appear immediately. No note
is written. Repeated rejection must not wait for another model call.

## Stale Proposal

Prepare the reference repair, then edit its source note before selecting
**Apply fixes**. The full batch must fail preflight before the first write. The
UI must explain that the vault changed and direct the user to check again.

## Provider Failure And Recovery

For Ollama, stop the service and select **Check vault**. Exactly one actionable
error must appear, with the last successful result preserved. Restart Ollama and
retry.

For OpenAI, separately test missing acknowledgement, missing/invalid key,
provider rejection, and a valid acknowledged configuration. The key must never
appear in Diagnostics, reports, traces, exports, or screenshots. Retry must
recover without reinstalling the plugin.

## Utility Surfaces

- **Settings** opens provider configuration directly.
- **History** shows scan and finding lifecycle metadata.
- **Diagnostics** contains readiness, Policy Studio, maintenance and impact
  tools, observability, retention, and technical stored-data controls.

These surfaces support recovery and investigation. They are not required for
the normal check, preview, approval, and result loop.

## Evidence

Manual outcomes are recorded in `docs/manual-acceptance-checklist.md`. Provider
quality is measured against `evals/release/northstar-v1.json`. Release status is
summarized in `docs/release-quality-report.md`.
