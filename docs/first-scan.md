# First scan

```bash
neuron init
# or later:
neuron scan
neuron scan --deep
neuron scan --update
neuron project-report
```

## What you get

1. Stack profile (frontend / backend / database / tools)
2. Architecture map under `.neuron/architecture.md`
3. Suggested constitution `.neuron/constitution.md` (**not auto-activated**)
4. Bootstrap memories in `.neuron/scan-memories.json`
5. Cursor patterns `.cursor/rules/project-patterns.mdc`
6. `Neuron Project Report` → `.neuron/project-report.md`

Open the project in Cursor and use MCP — the brain is ready for `neuron_prepare_task`.
