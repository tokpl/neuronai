# Graph reasoning

## Example: “What affects authentication?”

```text
AuthService
    ↓ DEPENDS_ON
User Model
    ↓ RELATED_TO
Permissions
    ↓ USES
Database
```

Output: **Impact map** (summary + optional mermaid) via `GraphReasoner` / `neuron_graph_query`.

## Retrieval integration

```text
User query
    → neuron_related_knowledge / graph neighbors
    → memories · documents · incidents · decisions
    → Cursor / retrieval-engine context assembly
```

Local only — no public plugin system, cloud graph, or marketplace.
