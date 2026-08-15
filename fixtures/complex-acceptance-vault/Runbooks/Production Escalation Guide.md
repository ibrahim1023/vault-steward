---
kind: runbook
owner: lee
updatedAt: 2026-07-27
---

# Production Escalation Guide

## Severity levels

| Level | Meaning                        | First owner           |
| ----- | ------------------------------ | --------------------- |
| S1    | Production imports blocked     | Incident commander    |
| S2    | Customer import degraded       | Regional support lead |
| S3    | Reversible configuration error | Delivery lead         |

## Escalation timeline

Capture the customer impact, rollback state, and next update time before
handing the incident to another team. ^escalation-timeline
