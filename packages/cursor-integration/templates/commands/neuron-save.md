# /neuron-save

Persist a durable engineering decision or pattern.

1. Draft a one-paragraph decision (context → choice → consequences)
2. Call `neuron_review_memory` if unsure it is worth saving
3. On confirm: `neuron_save_decision` or `neuron_store_memory`
4. If updating existing knowledge: `neuron_update_memory` (versioned)
5. Never store secrets
