# Debug Intelligence

Neuron remembers **how the project broke and healed** — not just that something failed.

## Debug workflow

```text
"Fix this error" / "API returns 500"
        │
        ▼
 neuron_debug_context
        │
        ├── related incidents
        ├── previous solutions / lessons
        ├── possible root causes
        └── risk factors
                │
                ▼
 Cursor proposes a fix (human-controlled)
                │
                ▼
 neuron_create_incident → resolve → incident memory
```

Package: `@neuron-ai-memory/debug-intelligence`  
Persistence: `.neuron/incidents.json`

Neuron **never** auto-deploys fixes or accesses production systems.

See [incidents.md](./incidents.md) and [root-cause-analysis.md](./root-cause-analysis.md).
