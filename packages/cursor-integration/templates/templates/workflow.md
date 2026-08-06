# Automatic Cursor + Neuron workflow

## Developer

> Dodaj system powiadomień

## STEP 1 - Analyze

Agent: “Analizuję istniejącą architekturę.”

Tool: `neuron_get_context` / `neuron_prepare_task`

## STEP 2 - Briefing

Neuron returns only top-ranked items, e.g.:

- existing event bus / queue
- libraries already in use
- prior decisions (“we use Redis for async jobs”)
- warnings (“do not poll the DB for notifications”)

## STEP 3 - Plan

Agent drafts a short plan (optional: `neuron_generate_plan`).

## STEP 4 - Implement

Code follows existing patterns.

## STEP 5 - Remember?

Agent: “Czy ta zmiana powinna zostać zapamiętana?”

Tools: `neuron_after_task` → AskQuestion (**Yes — remember it** / rephrase / **No — skip**) or plain Yes/No → `neuron_resolve_suggestion`
