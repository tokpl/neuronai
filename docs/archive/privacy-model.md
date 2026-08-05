# Privacy model

Neuron defaults to **LOCAL_ONLY**.

| Mode | Meaning |
|------|---------|
| `LOCAL_ONLY` | No cloud AI / telemetry assumptions; keep analysis on disk |
| `HYBRID` | Local memory + optional approved cloud models |
| `CLOUD_ALLOWED` | Cloud providers permitted under policy |

Privacy is part of `SecurityContext` and is audited when changed.

Secrets are never written to the audit log in cleartext. Context passed to models should go through `ContextSanitizer` / `neuron_check_context` first.

See also [security-core.md](./security-core.md) and the lighter `@neuron-ai-memory/security` package (consent + redaction helpers).
