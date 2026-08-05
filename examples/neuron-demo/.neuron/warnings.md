# Warnings — shoplite-neuron-demo

## Do not access database directly

Never `import pg` inside `apps/api` route handlers. Use `packages/db`.

## Do not write the payment ledger from HTTP

Ledger updates belong to outbox consumers — not `POST /payments/start`.
