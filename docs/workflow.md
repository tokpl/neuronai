# Neuron Deliver

Neuron installs **neuron-memory** + **/neuron-deliver**. Prime is part of `neuron init`.
Absolute is never installed.

## Enforcement (residual gaps closed)

| Gap | Fix |
| --- | --- |
| Soft codingAllowed | Agents honor `codingAllowed`; Cursor **`neuron-gate.mjs`** is **best-effort** Write deny while `gate.json` open (not Shell-proof; Antigravity = honor-only) |
| Honor checklistOk | **`checklistDone` must cover every playbook id**; `complete_checklist` action |
| Weak propose_waves | Refuses when code intel exists but seedPath does not resolve; quality `code\|map\|generic` |
| Thin playbooks | Richer UI/docs/polish/maintain checklist engines inside deliver |
| Invisible metrics | **`LAST_DELIVER.md`** (shareable when `.neuron/workflow/` is committed) + gitignored `history.jsonl`/`gate.json` + doctor |

After upgrades: reload Neuron MCP so the IDE catalog shows **9 tools** (incl. `neuron_resolve_clarify`, `neuron_workflow`).

## Loop

```text
CONTEXT → CLARIFY (gate.json + hook) → BLUEPRINT → propose_waves → EXECUTE → complete_checklist → VERIFY → remember → LAST_DELIVER.md
```

## Setup

```bash
neuron init
neuron cursor setup --force
neuron cursor doctor
```

Doctor checks: Deliver gate hook, Open deliver gate, Deliver history, Last deliver receipt.
