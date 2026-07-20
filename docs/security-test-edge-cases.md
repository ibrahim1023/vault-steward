# Security Analysis And Unit-Test Edge Cases

## Scope

This review covers the active trust boundaries: vault files/events, YAML policy,
local model configuration and responses, persisted SQLite records, approved
patches, trace data, portable bundles, and UI rendering. Vault content, model
output, synced `.obsidian` state, and persisted records are treated as malformed
or tampered input.

## Validated Security Findings

All four findings below were remediated on 2026-07-20. Focused regression
coverage and the full verification gate passed; the remaining backlog items
extend the protection with additional adversarial cases.

### P1: A loopback model call can follow a redirect to a remote host

[local-provider.ts](../src/model-provider/local-provider.ts) validates the
configured endpoint as loopback, but calls `fetch()` without `redirect: "error"`.
A hostile process on the configured local port can return a `307`/`308` redirect;
the redirect can replay the POST body, including vault evidence, to a remote
host. This violates the local-only provider boundary.

Remediation: disable redirects or validate every redirect target before a second
request. A redirect must surface as provider-unavailable.

Implemented: local-provider requests now use `redirect: "error"`, and redirect
responses are rejected before their body is processed.

### P1: An approval is not bound to an immutable validated proposal

[main.ts](../src/main.ts) reads `patchJson` using raw `JSON.parse()` during
review and apply. It does not call [proposal.ts](../src/contracts/proposal.ts)'s
`parseProposal()`, and the approval record binds only a proposal ID. A changed
SQLite proposal row can therefore differ from the previewed patch after approval
and still be applied to a same-vault Markdown file.

Remediation: parse and validate proposal records at creation, review, and apply;
store a canonical patch digest with approval; reject an apply if the approved
digest and persisted patch differ.

Implemented: persisted proposals are parsed at write/review/apply boundaries,
and approval plus apply are bound to the same canonical SHA-256 proposal digest.

### P2: Provider response limits and timeouts are bypassable in practice

The provider reads `response.text()` before checking its byte limit. A very
large/chunked body can consume memory first. It also accepts non-finite or huge
timeouts and limits, and a fetcher that resolves after its abort signal fires
can be treated as success.

Remediation: require finite bounded integers, reject excessive `Content-Length`
before reading, cap streaming reads, and check timeout state after fetch resolves.

Implemented: provider configuration is bounded, response bodies are read through
a capped stream, and late post-abort fetch resolution is treated as a timeout.

### P2: Vault parsing lacks enforced resource ceilings

[obsidian-reader.ts](../src/vault-adapter/obsidian-reader.ts) reads all Markdown
content and [scan.ts](../src/scanner/scan.ts) parses complete files without hard
limits for file count, bytes, frontmatter depth, headings, references, or total
parsed content. Performance budgets observe cost after the fact but do not stop
resource exhaustion.

Remediation: enforce reader/scanner budgets before parser work and fail safely
with a redacted oversized-vault or parse diagnostic.

Implemented: the reader and scanner now enforce file-count, per-file and total
byte, heading, reference, duplicate-path, and canonical-path limits before
unbounded parsing work proceeds.

## Test Backlog

Tick items only after a test fails against the unsafe behaviour where practical,
then passes with the required fail-closed behaviour.

### Provider And Network Boundary

- [ ] **P0** Reject 301/302/303/307/308 redirects to remote and alternate
      loopback destinations; assert no redirected request receives the prompt body.
- [ ] **P0** Reject endpoint credentials, fragments, encoded user-info,
      `localhost.`, IPv4-mapped IPv6, zone-ID IPv6, `NaN`, infinity, fractional,
      zero, negative, and excessive timeout/response-limit settings.
- [ ] **P1** Treat a fetch resolving after its timeout abort as timeout, not
      success; remove abort listeners after every exit path.
- [ ] **P1** Reject an oversized `Content-Length` before body read and abort a
      chunked body once cumulative bytes exceed the limit.
- [ ] **P1** Reject invalid JSON, arrays, null, missing/non-string provider
      output, whitespace-only output, and invalid `maxOutputTokens`.
- [ ] **P2** Confirm non-2xx status text and headers never reach diagnostics or
      trace metadata.

### Proposal, Approval, And Mutation

- [ ] **P0** Corrupt `patchJson` before approval; assert no approval record and
      no vault read/write occurs.
- [ ] **P0** Change a valid patch after approval; assert digest mismatch rejects
      apply, writes nothing, and marks the proposal stale/invalid.
- [ ] **P0** Reject operation paths containing traversal, dot segments, repeated
      separators, leading slash, backslash, NUL/control characters, or non-Markdown
      suffixes before the vault adapter is called.
- [ ] **P1** Reject inconsistent source revisions for operations on one file,
      out-of-range offsets, `Number.MAX_SAFE_INTEGER`, negative zero, Unicode
      surrogate-boundary offsets, absent expected text, and oversized replacements.
- [ ] **P1** When a write and rollback both fail, require recovery-needed status,
      a safe audit event, and no success result.
- [ ] **P1** Reject invalid/replayed approval actions and IDs.
- [ ] **P2** Reject repair targets containing newline, aliases, embeds, nested
      brackets, or external URI syntax; cite the exact duplicate occurrence.

### Vault, Parser, And References

- [ ] **P0** Reject unsafe file handles before read: absolute paths, dot
      segments, NUL/control characters, and canonical-path collisions.
- [ ] **P1** Ensure unsafe create/modify/rename events cannot poison invalidation
      queues, including an unsafe old path.
- [ ] **P1** Enforce max file count, per-file/total bytes, frontmatter bytes,
      headings, references, and queue depth before parsing.
- [ ] **P1** A parser exception in one note leaves no completed scan, partial
      review queue, or reusable parsed-note cache entry.
- [ ] **P1** Exercise deep YAML, aliases/merge keys, duplicate keys, invalid
      Unicode, huge single lines, and pathological bracket/link sequences.
- [ ] **P1** Reject file/data/javascript and encoded schemes, scheme-relative
      URLs, whitespace-prefixed schemes, and percent-encoded traversal in every
      wiki/embed/Markdown reference form.
- [ ] **P2** Prove anchor normalization cannot cause false valid targets and
      HTTP(S) links cannot become repair/retrieval targets.

### Model Evidence And Finding Normalization

- [ ] **P0** Reject `NaN`, infinity, unknown runtime severity/status/type, and
      malformed persisted finding records before UI hydration.
- [ ] **P1** Cap evidence paths, locators, excerpts, finding IDs, explanations,
      labels, and evidence count; reject control characters.
- [ ] **P1** Use tuple or length-prefixed evidence identity to prove colon-bearing
      path/locator values cannot collide.
- [ ] **P1** Send delimiter lookalikes, fake JSON, role labels, and repair
      instructions through every agent; assert uncited findings cannot result.
- [ ] **P2** Reject invalid evidence-context budgets and bound cache growth for
      many unique requests; discard cyclic malformed candidates without scan crash.

### Policy, Settings, Portability, Storage, And UI

- [ ] **P0** Test policy byte boundaries with multibyte UTF-8 and reject deep
      aliases, duplicate IDs/rules, long fields, and irrelevant operator values.
- [ ] **P1** Make invalid persisted settings reset atomically; no partial endpoint,
      model, schedule, or trace configuration survives.
- [ ] **P1** Validate portable settings through `parsePluginSettings`, policy
      through `parsePolicy`, and each decision's ID/action/timestamp through a
      bounded schema; reject prototype-pollution keys and unknown fields.
- [ ] **P1** Test corrupt/truncated SQLite, malformed finding/proposal JSON, and
      unknown migrations: no write may overwrite existing database bytes.
- [ ] **P1** Reject trace metadata with NaN/infinity, deep/large objects,
      prototype keys, or forbidden nested keys and values.
- [ ] **P2** Render hostile finding/model text containing HTML, scripts, CSS,
      bidi controls, and long unbroken strings; assert escaped output and usable UI.
- [ ] **P2** Confirm failed single/all trace deletion never claims success or
      deletes approvals, policies, active findings, or another scan's records.

## Suggested Test Placement

| Area                               | Suggested test file                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Provider redirects, limits, aborts | `tests/model-provider/local-provider.test.ts`                                                         |
| Persisted proposal integrity       | `tests/integration/review-workflow.test.ts` and `tests/contracts/proposal.test.ts`                    |
| Vault/parser bounds                | `tests/vault-adapter/obsidian-reader.test.ts` and `tests/scanner/scan.test.ts`                        |
| Reference URI handling             | `tests/reference/check.test.ts`                                                                       |
| Finding/model candidate validation | `tests/findings/normalize.test.ts` and `tests/agents/model-assisted.test.ts`                          |
| Policy, settings, and bundles      | `tests/policy/parse.test.ts`, `tests/plugin/settings.test.ts`, and `tests/portability/bundle.test.ts` |
| Persistence, trace, and UI         | `tests/storage/*.test.ts`, `tests/contracts/trace.test.ts`, and `tests/ui/*.test.tsx`                 |

## Release Gate

The P0 cases should be implemented and passing before any public beta or
marketplace submission. Resource-limit cases must use deterministic bounded
fixtures, not multi-gigabyte payloads.
