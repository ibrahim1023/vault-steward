# Manual Acceptance Suite

Use `fixtures/desktop-acceptance-vault/` as an Obsidian vault named
`Northstar Acceptance`. Keep an untouched copy for reset. The fixture contains
realistic launch notes and intentional defects; acceptance measures whether
Vault Steward makes the next useful action clear and safe.

Track results in
[manual-acceptance-checklist.md](manual-acceptance-checklist.md).

## Setup

1. Run `npm run package:plugin`.
2. Copy `dist/vault-steward/` to
   `<Northstar Acceptance>/.obsidian/plugins/vault-steward/`.
3. Enable Vault Steward and open it from the left-ribbon shield icon.
4. Configure Ollama in Obsidian settings. For the separate OpenAI pass, select
   OpenAI, enter the key, and accept the cloud-data acknowledgement.
5. Return to Vault Steward. Provider setup and readiness controls must remain
   outside the primary review surface.

Record the Obsidian version, macOS version, plugin version, provider/model, and
whether this is a fresh install or upgrade.

## Primary Journey

The initial surface must have one dominant action: **Check vault**. It must not
show health scores, severity counters, filters, confidence, raw evidence,
policy editing, model controls, maintenance, or observability.

Run **Check vault**. While scanning, verify that one progress message is shown
and the last successful result remains available. On completion, Vault Steward
must show either:

- a prepared repair with exact **Current**, **After**, and
  **Expected result** sections; or
- one plain-language issue with one concrete action.

The prepared repair should identify its source note and target status. An exact
rename candidate is labelled **Verified rename**. A model-ranked existing target
is labelled **AI suggestion - target exists**. The preview must make clear what
will change, how many findings are expected to resolve, and how many notes will
be edited.

Select **Apply fixes** only after reading the preview. Confirm that this single
action is the explicit approval event, duplicate actions are disabled while
applying, and success shows the actual applied, skipped, and failed results.
Select **Review next issue** and verify the workflow advances without returning
to a dashboard.

## Northstar Coverage

Use **View all issues** only to confirm that the completed scan includes the
relevant Northstar defects:

- broken reference in `Work/Partner Enablement.md`;
- broken anchor and missing embed in `Research/Customer Interviews.md`;
- unsupported target in `Notes/Working Agreement.md`;
- overdue, orphaned, duplicated, abandoned, and malformed tasks in
  `Work/Launch Readiness.md`; and
- missing rationale in `Decisions/ADR-004-Launch-window.md`.

Semantic findings may vary by provider and model. Each must still cite evidence
from the active scan and use cautious language.

## Prepared Reference Repair

Reset the fixture. Run **Check vault** and select the broken reference in
`Work/Partner Enablement.md` when needed. The intended safe change is:

```text
Current: [[Guides/Partner Migration Checklist]]
After:   [[Guides/Partner Onboarding Checklist]]
```

Confirm that the expected result is derived from the validated operations and
does not promise unrelated changes. Select **Apply fixes**. Verify that only the
approved reference changes, the vault is re-indexed, and the actual result
matches the write.

## Structured Task And Decision Repairs

Use a disposable copy of the Northstar fixture for this section. Append these
two tasks to `Work/Launch Readiness.md` after the existing checklist:

```text
- [ ] Reconcile the approved launch record owner:maya project:Projects/Northstar Launch.md status:done ^reconcile-launch-record
- [ ] Confirm the revised handoff date owner:maya project:Projects/Northstar Launch.md due:2026-07-01 ^handoff-date
```

Add `due: 2026-08-15` to the `Projects/Northstar Launch.md` frontmatter. In
`Decisions/ADR-004-Launch-window.md`, add a frontmatter `project` value of
`Projects/Missing.md`. Keep the decision's missing rationale state for the
separate rationale test.

Run **Check vault**. When a model prepares an eligible repair, confirm that
the preview identifies its repair kind and shows the exact task fragment or
frontmatter field under **Current** and **After**. A completion proposal may
only change `- [ ]` to `- [x]` for `reconcile-launch-record`; it must not infer
completion from prose. A due-date proposal must select the date exposed by the
task/project/linked-decision context. A decision association proposal must
replace only the broken existing `project` field with an existing project path.

For a missing rationale, accept only a one-to-three-sentence cited value in
the `rationale` frontmatter field. Reject a preview containing a link, a path,
multiple lines, a new note, or unrelated prose. Restore the disposable fixture
after this section.

When reference and structured proposals are simultaneously eligible, inspect
the mixed batch. Each row must identify its source and exact change. Edit any
one source note after the preview, then select **Apply**: the entire batch must
fail stale without writing any member. Restore the source and repeat; the
approved batch must re-index and report actual applied fixes.

## Batch And Stale Protection

When more than one safe proposal is prepared, confirm that each source,
locator, current reference, replacement reference, and target status is visible.
The button label must include the number of selected fixes.

Before applying a prepared batch, edit one source note manually. Selecting
**Apply fixes** must reject the entire batch as stale before any note is
written. Restore the fixture and repeat without the edit; all selected repairs
must preflight before the first write.

## Non-Repairable Findings

Review an overdue task, a missing-rationale decision, and an unsupported
reference. Each must show one sentence describing the issue and one concrete
action such as **Open note**, **Review both notes**, or **Not important**.
Selecting an item must never create or apply an unsupported patch.

## Settings, History, And Diagnostics

Confirm **Settings** opens provider configuration directly and **History**
shows lifecycle metadata without exposing note content. Open **Diagnostics**
only after completing the primary journey. Policy Studio, readiness,
maintenance, impact inspection, observability, retention, and stored-data
controls must remain there rather than in the default path.

Verify:

- two unchanged scans do not multiply persistent findings;
- History shows resolved and recurring lifecycle states;
- Observability displays metadata and evidence locators without raw note
  bodies, prompts, API keys, or unredacted model output;
- Policy Studio previews before saving and rejects invalid YAML;
- Maintenance impact remains review-only for destructive rename/delete cases.

## Provider Release Corpus

Run the same committed 26-case corpus independently after the interactive
provider checks:

```bash
OLLAMA_MODEL=<model> npm run eval:marketplace:ollama
OPENAI_MODEL=<model> OPENAI_API_KEY=<key> OPENAI_CLOUD_ACKNOWLEDGED=true npm run eval:marketplace:openai
npm run eval:marketplace:gate
```

Record the model identifiers and hardware profile in the release quality
report. Do not paste the OpenAI key into the checklist, terminal capture,
screenshot, or report. Both reports must pass with the same corpus fingerprint.

## Provider Recovery

With Ollama stopped, select **Check vault**. Exactly one actionable failure
message must appear, the last successful result must remain, and no partial
finding set may replace it. Start Ollama and retry successfully.

Repeat with OpenAI using an invalid or missing key, missing acknowledgement,
then a valid acknowledged configuration. OpenAI must remain clearly opt-in and
use the fixed provider configuration.

## Accessibility And Layout

Repeat the primary journey using keyboard only. Test the narrowest practical
sidebar, a wide pane, light theme, and dark theme. Verify visible focus, logical
tab order, one dominant action, readable Current/After content, non-color-only
status labels, and no overlapping or clipped text. Check the primary status and
error messages with VoiceOver.

## Report Format

For every issue, record:

1. action attempted;
2. selected finding or note;
3. expected result;
4. actual result; and
5. screenshot or screen recording.

Record live corpus metrics separately for Ollama and OpenAI: precision, recall,
F1, evidence validity, unsupported-finding rate, safe-repair validity, median
and p95 latency, retries, incomplete cases/scans, and unsafe remediations.
