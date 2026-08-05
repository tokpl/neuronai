# 05 — Architecture question

## Goal

Neuron answers “how is this built?” without dumping the whole repo.

## Steps (record)

1. Cursor chat:

   > Explain how payments and orders relate. Use Neuron.

2. Tools: `neuron_project_summary` / `neuron_get_context` / `/neuron-explain`.
3. Answer should mention:
   - `apps/api` + `apps/web`
   - Postgres
   - outbox / events
   - Permission / no direct DB from HTTP
4. Optional: `neuron_analyze_impact` for `payments`.

## Narration

> “Short, ranked context — never ten thousand memories.”

## End card

Links: README Quick Start · Discord/Discussions · Star the repo
