# /neuron-context

Fetch ranked project context for the current task.

1. Call `neuron_prepare_task` with the user's request (or `neuron_get_context`)
2. Summarize the **top 5** findings only
3. Point to related modules and warnings
4. Ask one clarifying question if risk is high
