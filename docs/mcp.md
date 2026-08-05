# MCP tools (MVP)

Neuron registers **13 tools**.

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
| `neuron_after_task` | Suggest save after work (stores pending draft) |
| `neuron_resolve_suggestion` | Apply user chat reply: Save / Edit / Ignore |
| `neuron_scan_project` | Bootstrap brain from codebase |
| `neuron_refresh_brain` | Refresh after changes |
| `neuron_project_summary` | Project overview |

## Save / Edit / Ignore (Cursor)

After `neuron_after_task`:

1. Agent prefers Cursor **`AskQuestion`** using `askQuestion` from the tool result (Save / Edit first / Ignore)
2. If `AskQuestion` is unavailable, show the plain **What you should do** instruction and ask the user to type the word
3. Agent calls `neuron_resolve_suggestion` with that action — without exposing tool/JSON details to the user
4. For `edit`, pass `title` and/or `content` overrides from the user’s follow-up

## Resources

- `neuron://project/context`
- `neuron://project/architecture`
- `neuron://project/decisions`

## Prompts

- `neuron_before_coding`
- `neuron_after_coding`

Experimental / enterprise tools live under `future/` and are **not** registered by default.
