---
name: neuron-deliver
description: >-
  Brain-gated delivery with Cursor best-effort gate hook, evidence-based playbook checklists,
  propose_waves from knowledge.code, and LAST_DELIVER.md. Triggers on deliver / plan and build /
  UI / docs / polish / maintain / feedback asks.
---

# Neuron Deliver — Brain-gated SDLC

## Enforcement

1. **`present.codingAllowed === false`** ? no app code (agents must honor this on every host).
2. **Cursor hook** `neuron-gate.mjs` — **best-effort** deny of Write/StrReplace/… while
   `.neuron/workflow/gate.json` is open (`failClosed` on `preToolUse`). Not universal: Shell and
   non-Cursor hosts can still mutate; always honor `codingAllowed`.
3. Board rejects execute while gate open; `completed` needs `remembered`.
4. **`checklistOk` / `verifyOk` require `signals.checklistDone` covering every checklist id** — use
   `neuron_workflow` `complete_checklist`.
5. **`propose_waves`** refuses when code intel exists but `seedPath` does not resolve (pass
   recommendation path). Optional `runbook`: `feature` | `incident` | `enterprise-change` | **`feedback`**.

Never install Absolute. Never use `.absolute-work/`. Prefer `neuron init` / `neuron prime` when Brain is thin.

## Loop

```
CONTEXT ? CLARIFY (gate.json) ? BLUEPRINT ? propose_waves ? EXECUTE ? complete_checklist ? VERIFY ? neuron_after_task ? LAST_DELIVER.md
```

Board lives under `.neuron/workflow/` (`neuron_workflow`). Waves carry `brainRefs`.  
Playbooks: build | ui | docs | polish | maintain.  
**(There is no separate “mobile” playbook.)** Device/browser proof for bug lists = runbook **`feedback`**.

## Feedback Triage (Flutter · Next.js · PHP · any UI)

When the user pastes a numbered list like `Feedback 21.10.2026_2` / `1. …` / `12b)…`:

```
Ingest ? Reproduce in product ? Fix confirmed ? Re-verify with evidence ? Remember
```

### Durable files (Easel-style)

On every board write with feedback items, Brain writes:

| Path | Purpose |
| --- | --- |
| `.neuron/workflow/feedback/FEEDBACK.md` | Human todo / status board |
| `.neuron/workflow/feedback/OPEN_QUESTIONS.md` | Asks waiting on the user |
| `.neuron/workflow/feedback/items.json` | Machine mirror of `feedbackItems` |
| `.neuron/workflow/evidence/fb-N/` | Before/after screenshots |
| `.neuron/workflow/board.md` | Full deliver board (also lists feedback) |

Resume next chat: open `FEEDBACK.md` + `get_board` — do not rediscover from scratch.

### Asking the user (Agent mode)

AskQuestion often **does not exist** in Agent mode. Then:

1. Write the question into the item: `needs_info` + `askPrompt` via `set_board`.
2. Brain regenerates `OPEN_QUESTIONS.md`.
3. **Ask in chat** (plain text) — quote `fb-id` and the question. Stop coding that item.
4. User answers in chat ? store `userAnswer` on the item ? reclassify to `confirmed` ? Fix.

Never invent product behavior when unclear. Never skip the chat ask.

Stack-agnostic capture:

| Surface | How to prove |
| --- | --- |
| Flutter / phone | adb screencap / Dart MCP ? `.neuron/workflow/evidence/fb-N/` |
| Next.js / web | browser screenshot ? same evidence folder |
| PHP / other | running UI shot, not code-only |

Rules:

1. Parse into `signals.feedbackItems` (`fb-1`, `fb-12b`, …) — **no code** on ingest.
2. Reproduce **in the running product**. Status: `confirmed` | `cannot_repro` | `by_design` | **`needs_info`**.
3. Unclear expected behavior ? AskQuestion **or chat** + `OPEN_QUESTIONS.md`; wait for `userAnswer`.
4. Fix wave **Brain-blocked** while any `needs_info` lacks `userAnswer`, or zero `confirmed`.
5. After fix: `after*.png` + vision notes ? `complete_checklist` with **existing** file paths.
6. Never mark “done” from reading source alone.

FEEDBACK_CHECKLIST ids: `surface-online`, `repro-in-product`, `screenshots-before`, `screenshots-after`, `vision-reviewed`, `asks-resolved`, `no-fantasy`.

## Verify = Reality Check (non-feedback)

Default **NEEDS WORK** until evidence exists. For **build** / **ui**: notes ?3 chars per id; `no-fantasy` ban.

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
| feature | clarify ? implement ? verify |
| incident | reproduce ? fix ? verify ? remember postmortem |
| enterprise-change | scope/risk ? implement ? security checklist ? verify |
| **feedback** | ingest ? reproduce in product ? fix confirmed ? re-verify ? remember |

## Express / Resume

**Express** only when Brain is rich **and** recommendation path is in map docs. Then: short blueprint ? `propose_waves` with seedPath ? implement ? `complete_checklist` ? verify ? remember.

`get_board` ? health + gate + history + feedbackItems + `feedbackDir`. Prefer `LAST_DELIVER.md` and `feedback/FEEDBACK.md`.
