# Security Threat Model

## Authority

This document owns security controls and trust boundaries. It complements, rather than replaces, `docs/ai-system.md` tool restrictions.

## Assets and Boundaries

Sensitive assets are vault content, attachment paths, policy files, local model prompts/results, SQLite data, and approval audit records. Trust boundaries exist at vault input, YAML parsing, model prompts/outputs, plugin configuration, optional local model HTTP endpoint, and the approval-to-apply transition.

| Threat                               | Required control                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection in notes            | Treat notes as data; fixed prompt delimiters; no write/shell/network tools; validate output and evidence deterministically. |
| Path traversal or malicious links    | Canonicalize paths and require them to remain within the active vault; reject traversal and URI schemes outside policy.     |
| Unauthorized mutation                | Apply only user-approved, revision-checked structured patches through the vault adapter; append audit record.               |
| Malformed YAML/Markdown/model output | Size/depth limits; schema validation; safe parser configuration; fail closed with diagnostics.                              |
| Local provider exposure              | Provider endpoint is explicit local configuration; no secret-bearing prompts; timeouts and response-size caps.              |
| Sensitive logging                    | Default metadata-only logs; redact content, paths, credentials, and prompts.                                                |
| Dependency compromise                | Lock dependencies, review plugin/model/parser updates, run planned audit checks, minimize packages.                         |
| Resource exhaustion                  | File, attachment, parser, queue, model-token, and timeout limits; cancellation and backpressure.                            |

## Authentication and Authorization

The initial product inherits the local Obsidian user session and has no remote accounts or tenants. The user selects the vault. Agent authorization is capability-based and read-only; mutation authorization is a UI approval token bound to a proposal and source revision.

## Enforcement Requirements

No cloud API, telemetry, remote storage, shell execution, or broad filesystem scanning may be introduced without a material ADR and explicit product-scope change. Security-relevant failures must be surfaced to the user without leaking note content in logs.
