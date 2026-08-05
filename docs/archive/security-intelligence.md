# Security Intelligence

Neuron helps developers write safer code by combining **security heuristics** with **project knowledge** (architecture, constitution, incidents).

It is **not** a classical vulnerability / CVE scanner and never auto-remediates.

## Principles

- Local-first analysis
- Never store secret **values** — only type, location, recommendation
- No production access
- No automatic security code changes

Package: `@neuron-ai-memory/security-intelligence`  
Persistence: `.neuron/security-memories.json`, `.neuron/security-report.md`

See [threat-modeling.md](./threat-modeling.md) and [security-workflow.md](./security-workflow.md).
