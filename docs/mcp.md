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
| `neuron_after_task` | Ask whether to remember knowledge after work (stores pending draft) |
| `neuron_resolve_suggestion` | Apply user answer: Yes / No / rephrase |
| `neuron_scan_project` | Bootstrap brain from codebase |
| `neuron_refresh_brain` | Refresh after changes |
| `neuron_project_summary` | Project overview |

## Remember this? (Cursor)

After `neuron_after_task`:

1. Agent prefers Cursor **`AskQuestion`** using `askQuestion` from the tool result (**Yes — remember it** / **Yes — but let me rephrase** / **No — skip**)
2. If `AskQuestion` is unavailable, show `promptText` (Type / Confidence / Reason / summary) and ask **Yes**, **No**, or **Edit**
3. Agent calls `neuron_resolve_suggestion` with that action — without exposing tool/JSON details to the user
4. For rephrase (`edit`), pass `title` and/or `content` overrides from the user’s follow-up

## Resources

- `neuron://project/context`
- `neuron://project/architecture`
- `neuron://project/decisions`

## Prompts

- `neuron_before_coding`
- `neuron_after_coding`

Experimental / enterprise tools live under `future/` and are **not** registered by default.
