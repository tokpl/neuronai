---
name: neuron-memory
description: >-
  Use Neuron AI Memory MCP tools for project context, decisions, and reviews
  in Cursor. Apply when starting features, refactoring, architecture questions,
  or after important coding outcomes.
---

# Neuron Memory skill (Cursor)

## Goal

Give the agent a **project brain**: architecture, decisions, patterns, and warnings - without overloading the context window.

## MVP tools (only these)

| Intent | MCP tool |
|--------|----------|
| Start a task / ranked context | `neuron_prepare_task` or `neuron_get_context` |
| Find something specific | `neuron_search_memory` |
| Save an architecture decision | `neuron_save_decision` |
| Store pattern / warning / fact | `neuron_store_memory` |
| Review prose for memorable knowledge | `neuron_review_memory` |
| Update existing knowledge | `neuron_update_memory` |
| After finishing work | `neuron_after_task` |
| Bootstrap / refresh brain | `neuron_scan_project` / `neuron_refresh_brain` |
| What is this project? | `neuron_project_summary` |
| Health check | `neuron_health` |

## Standard workflow

1. **Analyze** - `neuron_prepare_task` / `neuron_get_context`
2. **Implement** - follow existing patterns from Neuron
3. **Review & remember** - `neuron_after_task` or review + save

## Context budget

Return / consume only what fits the task:

- Small task → ~2k tokens / ~5 items
- Architecture task → up to ~10k tokens / ~16 items

Never paste thousands of memories into the chat.

## Privacy

Default is **suggest** mode - propose saves; do not silently store everything.
Local-first - no cloud account, no API key required for Neuron itself.
