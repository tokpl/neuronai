# Decisions — shoplite-neuron-demo

## Payments use event-driven flow

Problem: HTTP handlers writing the ledger caused partial failures and double charges.

Decision: Accept payment intent in API → write outbox event → async worker completes ledger + provider call.

Consequences: Controllers stay thin; retries live in the worker.

## Controllers never open the database

Problem: Scattered `pg` clients bypassed transactions and permissions.

Decision: All SQL goes through `packages/db`.

## Orders and payments share the transaction helper

Problem: Inconsistent begin/commit patterns across modules.

Decision: Use `packages/domain/transactions.js` (`withTransaction`) for both orders and payment acceptance.
