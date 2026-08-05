# Architecture review

`@neuron-ai-memory/architecture-review` answers:

> Is the system still well designed?

It **analyzes and proposes**. It does not rewrite the codebase.

## Flow

```text
modules + dependency edges
  → DependencyAnalyzer (cycles, coupling, unused)
  → BoundaryAnalyzer
  → ComplexityAnalyzer
  → ArchitectureRuleEngine
  → PatternDetector
  → ArchitectureHealthScore
  → RefactoringPlanner + TechnicalDebtMemory
  → architecture-health.md
```

## MCP tools

| Tool | Purpose |
|------|---------|
| `neuron_architecture_scan` | Full audit |
| `neuron_dependency_graph` | Dependency map |
| `neuron_refactor_plan` | Manual refactor plans |
| `neuron_architecture_score` | Health score |
| `neuron_architecture_review` | Cursor “Review this refactor” |

Pass optional `modulesJson` / `dependenciesJson`; otherwise a default Neuron-shaped graph is used.
