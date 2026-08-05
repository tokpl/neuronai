# Cursor + Neuron workflow

## Standard loop

```text
Developer request
    → BEFORE: neuron_prepare_task / neuron_get_context
    → Plan (optional neuron_generate_plan)
    → Implement (respect patterns / warnings)
    → AFTER: neuron_after_task → Save | Edit | Ignore
```

## Example session

**User:** Dodaj system powiadomień

**Cursor (STEP 1):** Analizuję istniejącą architekturę → `neuron_get_context`

**Neuron (STEP 2):** Top context only, e.g.

1. Events go through Redis streams  
2. Do not poll Postgres for fan-out  
3. Notification templates live in `packages/notify`

**Cursor (STEP 3):** Short plan aligned with those decisions  

**Cursor (STEP 4):** Implement  

**Cursor (STEP 5):** “Czy zapisać decyzję o kanale Redis?” → `neuron_save_decision`

## Slash-style commands

Installed under `.cursor/commands/`:

| Prompt file | Intent |
|-------------|--------|
| `neuron-context.md` | Ranked context |
| `neuron-plan.md` | Implementation plan |
| `neuron-review.md` | Architecture review |
| `neuron-save.md` | Persist decision |
| `neuron-explain.md` | Explain architecture |
| `architect.md` … `refactor.md` | Mode workflows (`/architect`, `/review`, `/debug`, …) — see [cursor-workflows.md](./cursor-workflows.md) |

## Context budget

| Task size | Tokens | Items |
|-----------|--------|-------|
| small | 2 000 | 5 |
| standard | 4 000 | 8 |
| large | 7 000 | 12 |
| architecture | 10 000 | 16 |

Never: “here are 10 000 memories”. Always: “here are the top N for this task”.
