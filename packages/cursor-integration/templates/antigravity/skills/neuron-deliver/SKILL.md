---
name: neuron-deliver
description: >-
  Brain-gated delivery with Cursor best-effort gate hook, evidence-based playbook checklists,
  propose_waves from knowledge.code, and LAST_DELIVER.md. Triggers on deliver / plan and build /
  UI / docs / polish / maintain / feedback asks.
---

# Neuron Deliver — Brain-gated SDLC

## Enforcement

1. **`present.codingAllowed === false`** → no app code (agents must honor this on every host).
2. **Cursor hook** `neuron-gate.mjs` — **best-effort** deny of Write/StrReplace/… while
   `.neuron/workflow/gate.json` is open (`failClosed` on `preToolUse`). Not universal: Shell and
   non-Cursor hosts can still mutate; always honor `codingAllowed`.
3. Board rejects execute while gate open; `completed` needs `remembered`.
4. **`checklistOk` / `verifyOk` require `signals.checklistDone` covering every checklist id** — use
   `neuron_workflow` `complete_checklist`.
5. **`propose_waves`** refuses when code intel exists but `seedPath` does not resolve (pass
   recommendation path). Optional `runbook`: `feature` | `incident` | `enterprise-change` | **`feedback`**.

Never install Absolute. Never use `.absolute-work/`.

## Loop

```
CONTEXT → CLARIFY (gate.json) → BLUEPRINT → propose_waves → EXECUTE → complete_checklist → VERIFY → neuron_after_task → LAST_DELIVER.md
```

Playbooks: build | ui | docs | polish | maintain.  
**(There is no separate “mobile” playbook.)** Device/browser proof for bug lists = runbook **`feedback`**.

## Feedback Triage (Flutter · Next.js · PHP · any UI)

When the user pastes a numbered list like `Feedback 21.10.2026_2` / `1. …` / `12b)…`:

```
Ingest → Reproduce in product → Fix confirmed → Re-verify with evidence → Remember
```

Stack-agnostic capture:

| Surface | How to prove |
| --- | --- |
| Flutter / phone | adb screencap / Dart MCP screenshot → `.neuron/workflow/evidence/fb-N/` |
| Next.js / web | browser screenshot (Playwright / computer-use / Easel) → same evidence folder |
| PHP / other | same — running UI shot, not code-only |

Rules:

1. Parse into `signals.feedbackItems` (`fb-1`, `fb-12b`, …) — **no code** on ingest.
2. Reproduce **in the running product**. Status: `confirmed` | `cannot_repro` | `by_design` | **`needs_info`**.
3. **If you do not understand expected behavior** → AskQuestion the user, set item `needs_info` + `askPrompt`, wait, store **`userAnswer`**, then reclassify (usually `confirmed`) and only then fix.
4. Fix wave is **Brain-blocked** while any `needs_info` lacks `userAnswer`, or while zero items are `confirmed`.
5. After fix: `after*.png` + vision notes → `complete_checklist` (FEEDBACK_CHECKLIST) with **existing** file paths.
6. Never mark “done” from reading source alone.

FEEDBACK_CHECKLIST ids: `surface-online`, `repro-in-product`, `screenshots-before`, `screenshots-after`, `vision-reviewed`, `asks-resolved`, `no-fantasy`.

## Verify = Reality Check (non-feedback)

Default **NEEDS WORK** until evidence exists. For **build** / **ui**: notes ≥3 chars per id; `no-fantasy` ban.

## Playbooks

| Playbook | Checklist |
| --- | --- |
| build | scripts-green, blueprint-diff, paths-honored, no-fantasy |
| ui | tokens, a11y, no-slop, responsive, motion, journey-ok, no-fantasy |
| docs | cited, diataxis, no-invent, outdated |
| polish | no-scope, hold-churn, complexity, tests-still |
| maintain | one-family, no-silent-majors, lockfile, verify-scripts |

## Runbooks

| Runbook | Phase order |
| --- | --- |
| feature | clarify → implement → verify |
| incident | reproduce → fix → verify → remember postmortem |
| enterprise-change | scope/risk → implement → security checklist → verify |
| **feedback** | ingest → reproduce in product → fix confirmed → re-verify → remember |

## Express / Resume

Express only when Brain is rich + recommendation path known.  
`get_board` → health + gate + history + feedbackItems. Prefer `LAST_DELIVER.md`.
