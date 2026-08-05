# Architect Mode

Neuron acts as a **Senior Software Architect** before large changes: analyze, propose, plan, surface risks — **never auto-code or auto-approve**.

## Workflow

```text
Developer: "Create marketplace system"
        │
        ▼
 neuron_architect (ARCHITECT mode)
        │
        ├── RequirementAnalyzer
        ├── SolutionDesigner (Option A/B)
        ├── ImplementationPlanner
        ├── ArchitectureRiskAnalyzer
        ├── Dependency impact (graph/memory)
        └── Pending ADR
                │
                ▼
 Cursor implements (human/agent coding)
                │
                ▼
 neuron_review_change / neuron_compare_architecture
```

Modes: `NORMAL` · `ARCHITECT` · `REVIEW` · `DEBUG`

Package: `@neuron-ai-memory/architect-mode`

## MCP

- `neuron_architect`
- `neuron_create_plan`
- `neuron_review_change`
- `neuron_compare_architecture`
- `neuron_generate_adr`

See [planning.md](./planning.md) and [architecture-review.md](./architecture-review.md).
