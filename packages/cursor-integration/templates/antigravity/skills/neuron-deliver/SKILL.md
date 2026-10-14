---
name: neuron-deliver
description: >-
  Brain-gated delivery on Antigravity (honor-only host gate). checklistDone evidence,
  propose_waves, LAST_DELIVER.md. No Absolute.
---

# Neuron Deliver (Antigravity)

Antigravity does **not** install a Write-deny hook. Gate is **honor-only**:

- If `present.codingAllowed === false` or `present.gate.required` → **do not write app code**
- Finish `neuron_resolve_clarify` until `gate.json` clears
- `propose_waves` with resolvable `seedPath` when code intel exists
- `complete_checklist` with full `checklistDone` before `verifyOk`
- Close with `neuron_after_task` then board `remembered: true` → `LAST_DELIVER.md`
- Thin Brain → `neuron init` / `neuron prime`
- Never Absolute / `.absolute-work/`

Cursor hosts additionally get best-effort `neuron-gate.mjs`; do not claim hard host deny here.
