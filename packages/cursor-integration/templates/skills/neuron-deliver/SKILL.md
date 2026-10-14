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
   recommendation path).

Never install Absolute. Never use `.absolute-work/`.

## Loop

```
CONTEXT → CLARIFY (gate.json) → BLUEPRINT → propose_waves → EXECUTE → complete_checklist → VERIFY → neuron_after_task → LAST_DELIVER.md
```

Board lives under `.neuron/workflow/` (`neuron_workflow`). Waves carry `brainRefs`. Playbooks: build | ui | docs | polish | maintain.

## Playbooks (engines-lite inside deliver)

| Playbook | Evidence via checklistDone |
| --- | --- |
| build | scripts-green, blueprint-diff, paths-honored |
| ui | tokens, a11y, no-slop, responsive, motion |
| docs | cited, diataxis, no-invent, outdated |
| polish | no-scope, hold-churn, complexity, tests-still |
| maintain | one-family, no-silent-majors, lockfile, verify-scripts |

## Express

Only when Brain is rich **and** recommendation path is in map docs. Then: short blueprint → `propose_waves` with seedPath → implement → `complete_checklist` → verify → remember.

## Resume

`get_board` → health + gate + history. Prefer `LAST_DELIVER.md` for team-visible last outcome.
