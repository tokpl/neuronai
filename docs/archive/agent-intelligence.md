# Agent Intelligence

Neuron as a **Senior Developer Assistant**: focused context before coding, plans without code dumps, architecture review, and risk analysis.

## Architecture

```text
Task
  → TaskAnalyzer
  → ContextEngine (graph + memory + rank)
  → PreparationReport / ImplementationPlanner
  → (code)
  → ArchitectureReviewer / ChangeRiskAnalyzer
  → SelfImprovementLoop
```

Package: `packages/agent-intelligence`

Modes: `fast` | `standard` | `architect` | `debug`

## Before-coding workflow

1. User: “Create new payment system”
2. Agent: `neuron_prepare_task`
3. Neuron returns architecture notes, decisions, warnings, suggested plan
4. Agent codes
5. Agent: `neuron_review_architecture`
6. Optional: `neuron_after_task` / `neuron_complete_task` for memory capture

## MCP tools

| Tool | Role |
|------|------|
| `neuron_prepare_task` | Focused prep context + plan |
| `neuron_review_architecture` | Score 0–100 + issues |
| `neuron_analyze_impact` | Blast radius / risk |
| `neuron_generate_plan` | Implementation steps only |
| `neuron_project_question` | Q&A over graph + memory |
| `neuron_complete_task` | Self-improvement memories |

## Resources

- `neuron://agent/context`
- `neuron://agent/recommendations`
- `neuron://agent/risks`
