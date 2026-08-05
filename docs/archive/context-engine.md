# Context Engine

Assembles a **small, ranked** briefing — never the entire memory store.

## Flow

```text
Task → TaskAnalyzer → Knowledge Graph lookup → Memory search
  → ContextRanker → AgentContext.briefing
```

## Ranking signals

| Signal | Weight (approx.) |
|--------|------------------|
| Task relevance | 0.35 |
| Importance | 0.25 |
| Graph distance | 0.20 |
| Freshness | 0.10 |
| Confidence | 0.10 |

## Example

Task: *Extend authentication middleware*

- High: “Auth uses JWT” (0.98-ish)
- Low: “Old login UI experiment” (0.12-ish)

## Modes

- **fast** — top few memories, no plan
- **standard** — decisions + warnings + plan
- **architect** — deeper graph + fuller plan
- **debug** — risks / blast radius emphasis
