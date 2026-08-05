# Knowledge Graph 2.0

Neuron’s **project brain graph** links code, decisions, docs, incidents, security, performance, and workflow context.

## Storage (MVP)

`GraphRepository` → `FileGraphRepository` (`.neuron/data/graph.json`).  
Indexed in-memory cache for traversal. No cloud graph / marketplace.

## Architecture

```text
nodes/     Code · Architecture · Knowledge · Security · Performance · Workflow
edges/     IMPORTS · DEPENDS_ON · IMPLEMENTS · CAUSED · FIXED_BY · …
queries/   GraphReasoner
ranking/   NodeImportanceScore
storage/   IndexedGraphCache (lazy)
visualization/  graph.json export (local only)
```

## Node families

| Family | Types |
|--------|--------|
| Code | FILE, FUNCTION, CLASS, MODULE, COMPONENT, SERVICE |
| Architecture | DECISION, PATTERN, RULE, PROJECT |
| Knowledge | MEMORY, DOCUMENT, INCIDENT |
| Security | THREAT, FINDING |
| Performance | BOTTLENECK, OPTIMIZATION |
| Workflow | TASK, SESSION |

## Relations

IMPORTS · DEPENDS_ON · IMPLEMENTS · CREATED_BY · CAUSED · FIXED_BY · REPLACES · VIOLATES · DOCUMENTS · AFFECTS · RELATED_TO (+ legacy CALLS/USES/…)

## Pipeline

```text
Query → Graph traversal (Reasoner / Impact) → Related memories → Context (Retrieval)
```

## MCP

- `neuron_graph_query`
- `neuron_impact_analysis` (+ `neuron_analyze_impact`)
- `neuron_related_knowledge`
- `neuron_project_map` / `neuron_graph_project_map`

See [project-brain.md](./project-brain.md) and [graph-reasoning.md](./graph-reasoning.md).
