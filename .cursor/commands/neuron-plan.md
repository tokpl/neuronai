# /neuron-plan

Create an implementation plan grounded in Neuron.

1. Call `neuron_context` with the user's goal (mode `deep` if it spans modules)
2. Prefer returned modules, files, symbols and rules when listing steps
3. Call out conflicts with existing decisions/patterns in the context
4. Keep the plan short and actionable — do not invent a second architecture
