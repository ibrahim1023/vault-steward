# Local Model Guidance

Vault Steward uses a configured loopback Ollama or llama.cpp-compatible endpoint for bounded semantic analysis. The provider must support the configured structured JSON response limits and remain available for the complete governed scan.

Start with the model selected in the plugin settings, run the readiness check, and measure it on synthetic fixtures before using it for a large vault. Local model quality and latency vary by model version, quantization, hardware, context length, and task. This repository does not publish a universal recommended model or memory requirement.

Use fixture evaluation, replay comparison, and local model comparison reports to record task-specific tradeoffs. A failed provider, timeout, or exhausted structured-output repair leaves the governed scan incomplete rather than accepting deterministic-only completion.
