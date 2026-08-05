---
name: neuron-memory
description: >-
  Use Neuron AI Memory MCP tools for project context, decisions, and reviews
  in Cursor. Apply when starting features, refactoring, architecture questions,
  or after important coding outcomes.
---

# Neuron Memory skill (Cursor)

## Goal

Give the agent a **project brain**: architecture, decisions, patterns, and warnings — without overloading the context window.

## When to use which tool

| Intent | MCP tool |
|--------|----------|
| Start a task / get ranked context | `neuron_prepare_task` or `neuron_get_context` |
| Find something specific | `neuron_search_memory` |
| Save an architecture decision | `neuron_save_decision` |
| Store other knowledge / pattern / warning | `neuron_store_memory` |
| Review prose for memorable knowledge | `neuron_review_memory` |
| Update existing knowledge | `neuron_update_memory` |
| After finishing work (suggest save) | `neuron_after_task` |
| Architecture / impact | `neuron_review_architecture`, `neuron_analyze_impact` |
| Implementation plan | `neuron_generate_plan` |

Legacy aliases in docs: *memory.get_context* → `neuron_get_context`, *memory.search* → `neuron_search_memory`, *memory.save_decision* → `neuron_save_decision`, *memory.review* → `neuron_review_memory`, *memory.update* → `neuron_update_memory`.

## Standard workflow

1. **Analyze** — `neuron_get_context` / `neuron_prepare_task`
2. **Plan** — use returned briefing (top ~5 items) + optional `neuron_generate_plan`
3. **Implement** — follow existing patterns
4. **Review & remember** — `neuron_after_task` or review + save

## Context budget

Return / consume only what fits the task:

- Small task → ~2k tokens / ~5 items
- Architecture task → up to ~10k tokens / ~16 items

Never paste thousands of memories into the chat.

## Privacy

Default is **suggest** mode — propose saves; do not silently store everything.
