# Project Brain

The **project brain** combines living docs under `.neuron/` with the **Knowledge Graph 2.0** (`.neuron/data/graph.json`).

## Files

| File | Role |
|------|------|
| `architecture.md` | Modules, services, tech, dependency graph |
| `constitution.md` | Suggested rules (human must approve) |
| `project-report.md` | Latest scan summary |
| `scan-memories.json` | Generated memory candidates |
| `data/graph.json` | Typed knowledge graph for impact / reasoning / viz |

## Graph + scanner

- Scanner bootstrap → architecture markdown + memory candidates  
- Knowledge graph → code/decisions/incidents/security/performance/workflow nodes  
- `neuron_project_map` returns both

## MCP

- `neuron_scan_project` / `neuron_refresh_brain`
- `neuron_project_map` / `neuron_graph_project_map`
- `neuron_graph_query` / `neuron_impact_analysis` / `neuron_related_knowledge`
