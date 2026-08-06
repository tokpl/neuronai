# /refactor

Plan a safe refactor with Neuron context.

1. Call `neuron_context` with the refactor goal (mode `deep`)
2. Prefer returned modules, symbols and impact hints before editing
3. Open only those paths; verify against source
4. Keep the change set small; propose memory updates via `neuron_after_task` when durable
