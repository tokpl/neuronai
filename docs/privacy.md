# Privacy

NeuronAI is **local-first** by default.

## Defaults

- Project knowledge lives under `.neuron/` on your machine (and in git if you choose to commit it)
- Telemetry and remote error reporting are **off** unless you explicitly enable them
- No NeuronAI cloud account is required for the open-source local product

## What may leave your machine

- Nothing, for core local MCP + file storage
- Optional calls to AI providers **you** configure (for example embeddings or models) — those follow that provider’s terms
- Future optional Cloud features (if you use them) would be covered by separate product terms

## Operator guidance

Treat `.neuron/` contents like sensitive project notes: do not commit secrets; redact logs; restrict MCP to trusted hosts.

See also [SECURITY.md](../SECURITY.md).
