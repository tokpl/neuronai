---
trigger: always_on
description: Neuron Project Brain loop — call neuron_context before exploring, remember after durable work, append contribution footer
---

# Neuron project memory

NeuronAI provides **project-aware context** so you do not rediscover the repository on every task.

Remembering durable decisions is a **core product loop**, not an optional courtesy. If you ship
architecture and never call `neuron_after_task`, the next session rediscovers the same work.

## Before coding (required)

Before broad repository exploration (listing trees, grepping for modules, hunting entrypoints):

1. Call `neuron_context` with the user's task.
2. Prefer the returned modules, files, symbols and rules.
3. Open those paths directly.
4. Search the repository only when Brain context is missing or insufficient.
5. Treat Brain suggestions as a shortlist, not guaranteed truth — verify against source files.
6. Honor `afterCoding` in the tool result — you will close that loop when work becomes durable.
7. Honor `contribution` / `present.footer` — you will append the summary at the end of your reply.

For a quick lookup rather than a full task, use `neuron_search`.

If the brain looks empty or architecture context is thin, call `neuron_scan` with mode `deep` (or ask the user to run `neuron scan --deep`) before large exploration.

## When you are unsure — ask (required)

If `neuron_context` returns `present.clarify` / `present.question` / `present.gate`:

1. Ask the first `present.question` (or `present.clarify.questions[0]`) and wait.
2. **HARD GATE:** if `present.gate.required`, do **not** write application code until answered.
3. Continue remaining clarify questions one at a time.
4. Still append `contribution.summary` at end of reply.

Otherwise if something material is ambiguous: ask one question; soft-recommend `neuron init`
or `neuron prime` when Brain is thin; prefer `neuron-deliver` for multi-file builds. Skip for typos/renames.

## During coding

Follow the decisions and constraints that came back. Do not invent a second architecture when
Neuron already documents one.

## End of reply (when you used neuron_context)

**Required every time** you called `neuron_context` this turn: append
`contribution.summary` **exactly once** at the end of the user-visible reply.
Keep the 🌱 emoji and the line break. Do not invent numbers. Do not dump raw JSON.

This is **independent of remembering / autosave / privacy mode**. Even if
`neuron_after_task` already saved a memory (`persisted`), or you only wrote a short
“Saved to Project Brain: …” line — you still append `contribution.summary` last.

This reports **tokens of context saved** by Project Brain compression —
not IDE / agent bill savings.

Example:

```
🌱 Neuron · saved ~800 tokens of context
Used 6 memories from Project Brain
Pointed the agent to 3 file/module paths and 1 project rule
Context is ~5.4× more compact than matched Project Brain knowledge
Ranked this context in 26 ms
```

## After coding (required)

Call `neuron_after_task` with a short summary of what changed **before you end the turn** whenever
any of these is true:

- You finished implementing a feature, refactor, migration, or accepted plan
- You chose/replaced a library, canonical component, ownership boundary, or sync/policy rule
- You established durable UX or domain rules
- You are about to say the work is done / zaimplementowane / wdrożone

Do **not** wait for the user to ask “should we remember this?”. Propose it yourself.

Skip only for truly trivial edits (typo, rename, comment-only).

Follow `present` from the tool result:

- If `persisted` is set (privacy **automatic** / autosave): do **not** ask Yes/Edit/No.
  Briefly say what was saved (`draft.title`). Still append `contribution.summary` if you used
  `neuron_context`.
- If `suggest` is true and `question` is present: show `question.prompt` as plain text in chat,
  then call `neuron_resolve_suggestion` with `save` | `edit` | `ignore` after the user answers.

If there is no durable knowledge, do not invent one — but still call `neuron_after_task`
(`suggest: false` is fine). Always keep the contribution footer when `neuron_context` was used.

## Rules

- Never show MCP tool names or raw JSON to the user
- Never store secrets, tokens, credentials or personal data
- Never store chat transcripts
- Prefer updating an existing memory (`neuron_update`) over adding a near-duplicate

For the full workflow, also follow the `neuron-memory` skill when it is available.
