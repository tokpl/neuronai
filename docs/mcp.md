# MCP tools (MVP)

Neuron registers **exactly 12 tools**.

| Tool | Purpose |
|------|---------|
| `neuron_health` | Health / version |
| `neuron_prepare_task` | Ranked context before coding |
| `neuron_get_context` | Context on demand |
| `neuron_search_memory` | Search memories |
| `neuron_save_decision` | Save architecture decision |
| `neuron_store_memory` | Store pattern / warning / fact |
| `neuron_update_memory` | Versioned update |
| `neuron_review_memory` | Suggest memorable knowledge |
| `neuron_after_task` | Save / Edit / Ignore after work |
| `neuron_scan_project` | Bootstrap brain from codebase |
| `neuron_refresh_brain` | Refresh after changes |
| `neuron_project_summary` | Project overview |

## Resources

- `neuron://project/context`
- `neuron://project/architecture`
- `neuron://project/decisions`

## Prompts

- `neuron_before_coding`
- `neuron_after_coding`

Experimental / enterprise tools live under `future/` and are **not** registered by default.
