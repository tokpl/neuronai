# Architecture — shoplite-neuron-demo

Stack: javascript, express, postgresql, static web

## Notes

- `apps/web` — storefront UI
- `apps/api` — HTTP API (`orders`, `payments`)
- `packages/db` — **only** place for SQL / outbox persistence
- `packages/domain` — shared `withTransaction` pattern
- Payments enqueue `payment.requested` to the outbox; workers (not shown) write the ledger
