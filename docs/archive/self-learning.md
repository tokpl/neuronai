# Self-learning memory evolution

Neuron observes project knowledge over time and **suggests** how the constitution should evolve. It does not autonomously change code or activate CRITICAL policy.

## Loops

### Pattern mining

Repeated `*Service` / `*Repository` / `useX` names → proposed architecture or naming rules.

### Mistake learning

Mistake memories and developer corrections → WARNING suggestions and mistake ledger in the constitution.

### Decision evolution

Architecture decisions keep `currentState` + `history[]` with reasons (e.g. REST → GraphQL).

### Tech debt memory

TODO / deprecated / “temporary workaround” signals → tracked debt with reminders.

### Periodic review

After ~50 commits (configurable), Neuron may prompt:

```text
Project evolved.
Found:
3 outdated rules
5 new patterns
2 architecture conflicts
Review?
```

## Advisor boundaries

| Allowed | Not allowed |
|---------|-------------|
| Suggest rules | Auto-activate CRITICAL |
| Write Cursor rules from **active** constitution | Silently rewrite application code |
| Health score heuristics | Claim absolute truth |

## Cursor workflow

Developer works → Neuron suggests rule → developer accepts → `neuron_generate_cursor_rules` → Cursor agents inherit project policy.
