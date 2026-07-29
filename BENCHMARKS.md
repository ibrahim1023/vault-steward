# Local Benchmarks

Vault Steward benchmark artifacts are reproducible local evidence, not claims of a
universal best model. They contain synthetic fixture identifiers, ground-truth
counts, model/configuration labels, aggregate latency and memory measurements,
and quality metrics. They never contain user-vault notes, excerpts, prompts, raw
model output, API keys, URLs, or absolute paths.

## Reproduce

```bash
npm run eval:synthetic
npm run eval:retrieval
npm run evals -- --replay --manifest evals/manifests/ci-regression.json
npm run release:quality
```

Use the checked-in `evals/synthetic/configs/small.json` configuration for the
baseline synthetic corpus. Record the exact model, provider, hardware, prompt
registry fingerprint, policy version, fixture manifest hash, and command date
next to any comparison report. Compare only matching fixture manifests and a
single changed configuration variable.

The benchmark generator is deterministic for a supplied seed. Each injected
broken reference, duplicate entity, contradiction, stale note, orphan task,
schema violation, and unresolved decision is represented in ground truth before
grading. Generated vaults and reports stay ignored under `evals/generated/` and
`evals/reports/`.

## Supported Configurations

Supported means a provider/profile has a passing, current local release report.
It does not mean every local or cloud model is supported. Ollama is local-first.
OpenAI requires explicit acknowledgement and a separate passing report.
