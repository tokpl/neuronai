# 03 — First task

## Goal

Show **with Neuron** vs inventing architecture.

## Prep

- `examples/neuron-demo` opened in Cursor
- MCP server **neuron** enabled (green)
- New Agent chat

## Steps (record)

1. Brief flash of `.neuron/decisions.md` (payments event-driven).
2. In Cursor chat, type exactly:

   > Add a payment system. Use Neuron before coding.

3. Show tool calls: `neuron_prepare_task` or `neuron_get_context`.
4. Highlight returned briefing:
   - existing transaction / payment module pattern
   - warning: do not access DB from controllers
   - decision: event-driven payments
5. Show agent plan that **extends** outbox — not a greenfield Stripe rewrite.

## Narration

> “Without Neuron the agent guesses. With Neuron it inherits your decisions.”

## Optional B-roll

Split screen with `BEFORE_AFTER.md` from the demo.
