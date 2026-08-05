# Conflict resolution

## Example

```text
Memory A: Use REST API
Memory B: Use GraphQL

Neuron: Conflict detected (MemoryConflictDetector)
→ requiresApproval: true
→ suggestion: supersede older after team review
```

Neuron **never** silently picks a winner or deletes either memory.

## Duplicates

```text
"Use Redis cache" ≈ "Redis is used for caching"
→ MemorySimilarityEngine merge suggestion
```

## Validation

`MemoryValidator` sources: code analysis, developer approval, tests, git history.

Example: “Payment uses Stripe” validated by `stripe-client.ts`.

See [memory-lifecycle.md](./memory-lifecycle.md).
