---
name: neuron-memory
description: >-
  Use Neuron project memory for context, decisions and reviews in Antigravity.
  Apply when starting features, refactoring, answering architecture questions,
  after an important coding outcome, or whenever durable project knowledge was
  just established — proactively call neuron_after_task; do not wait for the user
  to ask to remember. Always append contribution.summary after neuron_context.
---

# Neuron project memory (Antigravity)

Neuron tells you **where to look** and **what rules apply** before you rediscover the project.
It also must **capture** durable decisions so the next session does not rediscover them.

## Before exploring the repo

1. Call `neuron_context` with the task.
2. Prefer returned modules / files / symbols / rules.
3. Open those files.
4. Broad-search the tree only if context is empty or clearly incomplete.
5. Verify Brain tips against source — Neuron accelerates; the code is authority.
6. Note `afterCoding` in the result — you owe a `neuron_after_task` call when work becomes durable.
7. Note `contribution` — append `contribution.summary` once at the end of your user-visible reply.

If architecture context is thin, call `neuron_scan` with mode `deep` before rediscovering the tree.

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

## End of reply (when you used neuron_context)

**Required** after any `neuron_context` call: append `contribution.summary` once
(keep 🌱 + line break). Never invent numbers; never dump raw metrics JSON;
never call it IDE bill savings — it is Project Brain context compression.

**Autosave / `neuron_after_task` never cancels this footer.** If a memory was already
saved (`persisted`), only skip the Yes/Edit/No survey — still print `contribution.summary`.

## After coding (required)

After durable work — before saying done / zaimplementowane / wdrożone:

`neuron_after_task` → follow `present` from the result:
- `persisted` set → brief “Saved to Project Brain: …” (no confirmation UI)
- else → show `question.prompt` in chat → `neuron_resolve_suggestion`

Do **not** wait for the user to ask. Propose remembering yourself.
Never drop `contribution.summary` because of autosave.

Skip only trivial edits (typo / rename / comment).

## Context budget

| Mode | Budget | Use for |
| --- | --- | --- |
| `minimal` (default) | 500 tokens | everyday coding |
| `standard` | 1200 tokens | multi-file features |
| `deep` | 3500 tokens | architecture and refactors |

One markdown document. Do not ask for "all memories".

## Privacy

Antigravity-only projects often use **automatic** privacy (silent high-confidence saves).
Local-first — no cloud, no API key, no telemetry.

## MCP permissions

If Neuron tools keep prompting for approval, ask the user to Allow `mcp(neuron/*)` in
Antigravity permission settings so the Project Brain loop can run without friction.
