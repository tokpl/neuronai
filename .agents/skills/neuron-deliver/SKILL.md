---
name: neuron-deliver
description: >-
  Brain-gated delivery with Cursor best-effort gate hook, evidence-based playbook checklists,
  propose_waves from knowledge.code, and LAST_DELIVER.md. Triggers on deliver / plan and build /
  UI / docs / polish / maintain asks.
---

# Neuron Deliver — Brain-gated SDLC

## Enforcement

1. **`present.codingAllowed === false`** → no app code (agents must honor this on every host).
2. **Cursor hook** `neuron-gate.mjs` — **best-effort** deny of Write/StrReplace/… while
   `.neuron/workflow/gate.json` is open (`failClosed` on `preToolUse`). Not universal: Shell and
   non-Cursor hosts can still mutate; always honor `codingAllowed`.
3. Board rejects execute while gate open; `completed` needs `remembered`.
4. **`checklistOk` / `verifyOk` require `signals.checklistDone` covering every playbook id** — use
   `neuron_workflow` `complete_checklist`.
5. **`propose_waves`** refuses when code intel exists but `seedPath` does not resolve (pass
   recommendation path). Optional `runbook`: `feature` | `incident` | `enterprise-change`.

Never install Absolute. Never use `.absolute-work/`.

## Loop

```
CONTEXT → CLARIFY (gate.json) → BLUEPRINT → propose_waves → EXECUTE → complete_checklist → VERIFY → neuron_after_task → LAST_DELIVER.md
```

Board lives under `.neuron/workflow/` (`neuron_workflow`). Waves carry `brainRefs`. Playbooks: build | ui | docs | polish | maintain.

## Verify = Reality Check (Brain-enforced)

Default status is **NEEDS WORK** until evidence exists. For **build** and **ui**:

- Every checklist id must appear in `checklistDone`.
- Every id needs `checklistNotes[id]` (≥3 chars): script output, file path, or screenshot path.
- `no-fantasy` — ban “production ready / 98/100 / zero issues” without those notes.
- UI also requires `journey-ok` (entry → action → result + what was checked).

`complete_checklist` and board validation reject `checklistOk` / `verifyOk` when notes are missing. There is no separate reality-checker skill.

## Playbooks (engines-lite inside deliver)

| Playbook | Evidence via checklistDone (+ notes on build/ui) |
| --- | --- |
| build | scripts-green, blueprint-diff, paths-honored, no-fantasy |
| ui | tokens, a11y, no-slop, responsive, motion, journey-ok, no-fantasy |
| docs | cited, diataxis, no-invent, outdated |
| polish | no-scope, hold-churn, complexity, tests-still |
| maintain | one-family, no-silent-majors, lockfile, verify-scripts |

## Runbooks (thin wave templates)

Pass `runbook` to `propose_waves` (or let Brain detect from the goal):

| Runbook | Phase order |
| --- | --- |
| feature | clarify → implement → verify |
| incident | reproduce → fix → verify → remember postmortem |
| enterprise-change | scope/risk → implement → security checklist → verify |

Waves still come from `knowledge.code` / seedPath — runbooks only arrange phases.

## Express

Only when Brain is rich **and** recommendation path is in map docs. Then: short blueprint → `propose_waves` with seedPath → implement → `complete_checklist` → verify → remember.

## Resume

`get_board` → health + gate + history. Prefer `LAST_DELIVER.md` for team-visible last outcome.
