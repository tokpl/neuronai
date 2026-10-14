# /neuron-deliver

Host-enforced Brain delivery (gate hook + checklist evidence + propose_waves).

1. `neuron_context` (`deep`) — honor `codingAllowed` / gate / checklist
2. Clarify → `neuron_resolve_clarify` until `gate.json` clears (Cursor best-effort hook may block Write; always honor `codingAllowed`)
3. Blueprint → `neuron_workflow propose_waves` with seedPath from recommendation
4. Execute waves → `complete_checklist` with full `checklistDone` → verify scripts
5. `neuron_after_task` → `remembered: true` → `LAST_DELIVER.md`
6. Follow the `neuron-deliver` skill
