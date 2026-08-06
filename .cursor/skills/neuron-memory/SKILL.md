---
name: neuron-memory
description: >-
  Use Neuron project memory for context, decisions and reviews in Cursor.
  Apply when starting features, refactoring, answering architecture questions,
  or after an important coding outcome.
---

# Neuron project memory (Cursor)

Neuron tells you **where to look** and **what rules apply** before you rediscover the project.

## Before exploring the repo

1. Call `neuron_context` with the task.
2. Prefer returned modules / files / symbols / rules.
3. Open those files.
4. Broad-search the tree only if context is empty or clearly incomplete.
5. Verify Brain tips against source — Neuron accelerates; the code is authority.

## Tools

| Intent | Tool |
| --- | --- |
| Start a task with ranked context | `neuron_context` |
| Look something up | `neuron_search` |
| Store a decision, pattern, warning or fact | `neuron_remember` |
| Change existing knowledge (versioned) | `neuron_update` |
| Propose what to remember after coding | `neuron_after_task` |
| Apply the user's Yes / Edit / No answer | `neuron_resolve_suggestion` |
| Rebuild the brain from the codebase | `neuron_scan` |

## After coding

`neuron_after_task` → **show the proposed memory** (`draft.content` / `question.prompt`) →
ask Yes / Edit / No → `neuron_resolve_suggestion`.

Never ask for confirmation before the user has seen the durable knowledge that would be stored.
Edit rewrites that proposed memory text, not the code.

## Context budget

| Mode | Budget | Use for |
| --- | --- | --- |
| `minimal` (default) | 500 tokens | everyday coding |
| `standard` | 1200 tokens | multi-file features |
| `deep` | 3500 tokens | architecture and refactors |

One markdown document. Do not ask for "all memories".

## Privacy

Default mode is **suggest**: Neuron proposes, the user decides. Local-first — no cloud, no API key,
no telemetry.
