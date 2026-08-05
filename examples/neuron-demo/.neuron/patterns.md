# Patterns — shoplite-neuron-demo

## API envelope

Responses use `{ data, error, meta }`.

## Outbox event shape

```json
{ "type": "payment.requested", "orderId": 1, "amount": 42, "provider": "stripe-checkout" }
```
