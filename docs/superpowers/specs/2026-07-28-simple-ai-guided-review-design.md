# Simple AI-Guided Review Design

## Purpose

Vault Steward should solve vault problems faster than a user could diagnose
them manually. The default interface must therefore present prepared outcomes,
not internal subsystems. The primary flow is:

`Check vault -> review exact changes -> apply approved fixes -> see the result`

AI performs bounded triage and recommendation. Deterministic code remains
authoritative for evidence validation, patch construction, outcome calculation,
approval, revision checks, writes, rollback, and re-indexing.

## Default Experience

The first screen contains the vault label, last check status, provider readiness
only when action is required, and one primary `Check vault` action.

After a completed scan, Vault Steward selects the highest-value actionable
result:

- When repair proposals are ready, show the affected note and locator, current
  reference, exact replacement, target status, and expected outcome.
- When a finding cannot be safely repaired, show one plain-language explanation
  and one recommended action such as `Open note`, `Review both notes`, or
  `Not important`.
- When no findings require attention, show one calm healthy result and the next
  scheduled or manual check action.

The default path does not show health scores, severity counters, confidence,
filters, raw evidence objects, policies, traces, agent names, prompts, or model
controls. `View all issues` is secondary. Provider configuration opens Obsidian
settings. Policy, maintenance, history, and observability remain available from
one separate Advanced surface.

## Repair Preparation

Repair recommendations are limited to broken internal references. Candidate
targets come only from the active immutable vault snapshot and bounded
rename/alias metadata. The selected model provider may choose one candidate or
abstain through typed structured output. Deterministic validation rejects a
target that is absent from the snapshot, belongs to another scan, lacks source
evidence, or cannot produce an existing `replace-range` proposal.

An exact rename mapping is labelled `Verified rename`. A model-ranked target is
labelled `AI suggestion - target exists`; it is never described as verified or
correct merely because the note exists. Models do not produce patch offsets,
replacement syntax, proposal digests, approvals, or writes.

## Prepared Repair Batch

A prepared batch references individually persisted, digest-bound proposals. It
stores no additional note excerpts. Its deterministic expected outcome contains
only:

- expected findings resolved;
- distinct notes edited;
- notes created;
- notes deleted; and
- findings left unchanged.

The review view joins each proposal with its finding and renders the current and
replacement references already present in the proposal operations. The user may
deselect an item. The single `Apply N fixes` action is the explicit approval for
the selected proposals.

Before any write, the workflow validates every proposal, digest, approval, scan
binding, operation range, expected text, source revision, and cross-proposal
overlap. A failed preflight rejects the entire batch. Runtime writes reuse the
existing grouped-write, compensating rollback, recovery-required, audit, and
re-index behavior.

## Result and Judgment States

After apply, show actual results: fixes applied, notes edited, fixes stopped,
and whether re-indexing completed. Do not repeat the expected outcome as though
it were observed. The only primary follow-up is `Review next issue`.

Non-repairable findings expose one deterministic action selected by finding
type:

- task or decision: open the cited note;
- contradiction: review the two cited notes;
- staleness, schema, policy, or entity issue: open the primary cited note;
- any unsupported case: view the issue without a write action.

`Not important` records the existing explicit review feedback/dismissal action.
It never changes policy automatically.

## State Model

The default workspace uses these states:

1. `ready`: one check action and last successful status;
2. `scanning`: one progress message, with the last successful result retained;
3. `recommendation`: prepared repair preview or recommended judgment action;
4. `applying`: duplicate actions disabled;
5. `result`: actual apply and re-index outcome;
6. `error`: one actionable, content-safe recovery message.

State transitions do not authorize writes. Approval and apply remain explicit
workflow operations.

## Privacy and Safety

Ollama remains the local-first default. OpenAI remains opt-in and requires the
existing acknowledgement. Candidate paths and bounded cited evidence may be
sent only through the already selected and authorized provider. Raw prompts,
model output, note bodies, secrets, endpoints, and absolute paths remain absent
from default telemetry and exports.

No automatic writes, semantic text drafting, new remote service, or unsupported
repair family is introduced.

## Documentation and Acceptance

README, architecture, interfaces, AI boundaries, security/privacy, testing,
known limitations, manual acceptance, release, and progress documentation must
describe the result-first experience consistently.

Acceptance must prove:

- one dominant action per state;
- exact current/after preview;
- accurate expected-versus-actual result language;
- verified versus AI-suggested target labels;
- batch preflight and approval safety;
- no unapproved or partial preflight write;
- provider failure recovery;
- keyboard, narrow-pane, and light/dark theme usability; and
- Advanced tools remain available without appearing in the default path.
