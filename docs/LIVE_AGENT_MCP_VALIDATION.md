# Live agent MCP validation (P0 FINAL)

**Date:** 2026-08-06  
**Evidence:** [`live-agent-mcp-report.json`](../live-agent-mcp-report.json)

---

## Final verdict

# STOPPED — MCP_PROOF FAILED

Live 20×A / 20×B was **not** run. No `PROVEN`, no invented exploration deltas, no token savings.

| Label | Status |
| --- | --- |
| `MCP_PROOF` | **FAILED** |
| `LIVE_AGENT_PROOF` | **NOT_RUN** |
| `TRACE_QUALITY` | **N/A** |
| `REPEATABILITY` | **N/A** |
| `STDIO_FIXTURE_CONTEXT` | **PASS** (CLI only — not MCP) |

---

## 1. Methodology (intended)

Two arms on the same disposable TypeScript payments fixture:

| Arm | Behavior |
| --- | --- |
| **A — Neuron OFF** | Standard repo exploration only (`Glob`/`Grep`/`Read`/list). No Neuron MCP. |
| **B — Neuron ON** | **Must** start with real Cursor MCP `neuron_context`, then targeted reads of returned paths only. |

Hard evidence: ordered tool-use traces per run (task id, arm, tools, whether `neuron_context` was called, exploration counts, file reads, first useful path, broad rediscovery, answer, correct start, rule adherence, hallucinated paths, success).

B starting with `list_dir` / broad `rg` before `neuron_context` = **rediscovery violation**.

**Not allowed as MCP proof:** CLI `neuron context`, scripted exploration, self-reported counts, `estimatedRediscoveryAvoided`.

---

## 2. MCP catalog (this session)

### After operator reload (earlier)

Product Neuron surface was visible and callable (`neuron_context` present). Smoke against **monorepo** brain returned weak/empty billing location (expected — this repo is NeuronAI, not the payments app).

### After fixture bind attempt (now)

To make B return the **fixture** brain, `.cursor/mcp.json` was retargeted:

```json
{
  "mcpServers": {
    "neuron": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\projekty\\neuron-ai-memory\\apps\\cli\\dist\\index.js", "mcp"],
      "env": {
        "NEURON_CWD": "c:\\projekty\\neuron-ai-memory\\.tmp\\live-mcp-ab-fixture"
      }
    }
  }
}
```

The live `node … mcp` process was killed so Cursor could respawn with the new `NEURON_CWD`.

**Result:** `GetMcpTools` no longer lists `project-0-neuron-ai-memory-neuron`. Catalog servers: GitLab, Context7, Playwright only. **`neuron_context` is not callable.**

Expected product tools (7):

1. `neuron_context`
2. `neuron_search`
3. `neuron_remember`
4. `neuron_update`
5. `neuron_after_task`
6. `neuron_resolve_suggestion`
7. `neuron_scan`

Per brief: tool-not-found / server absent → **STOP**, `MCP_PROOF = FAILED`.

---

## 3. Fixture (ready)

Path: `.tmp/live-mcp-ab-fixture`  
Builder: `scripts/live-agent-validation.mjs#buildLiveFixture` + noise modules (`billing-ui`, `billing-admin`, `health.ts`, `legacy`, …).

Remembered:

- **Rule:** Never call Stripe/payment provider directly from route handlers. Payment routes must use PaymentService.
- **Decision:** All payment orchestration goes through PaymentService…

CLI `neuron context "Where is billing implemented?"` on the fixture returned Recommended start `src/api/routes/payments.ts` plus the rule/decision. That is **stdio/CLI evidence only**.

---

## 4. Raw trace summary

| Item | Value |
| --- | --- |
| Runs collected | **0** |
| Reason | Benchmark not started after `MCP_PROOF = FAILED` |

---

## 5. A/B metrics

All null — **not measured**. No placeholder averages.

| Metric | A | B | Delta |
| --- | ---: | ---: | ---: |
| exploration tool calls | — | — | — |
| file reads | — | — | — |
| broad rediscovery rate | — | — | — |
| first useful file | — | — | — |
| correct start | — | — | — |
| rule adherence | — | — | — |
| task success | — | — | — |
| hallucinated paths | — | — | — |

---

## 6. Per-task results

None. Planned task list is in `live-agent-mcp-report.json` (`T01`–`T20`).

---

## 7. Failures

1. **F1** — MCP process not respawned after kill; Neuron server vanished from IDE catalog.
2. **F2** — Fixture bind via `NEURON_CWD` requires Cursor to restart MCP (manual toggle/reload).
3. **F3** — Live A/B correctly not run (honest stop).

---

## 8. Limitations

- This agent cannot toggle Cursor MCP settings.
- Prior finding **D**: Task subagents reuse parent MCP and do not load nested fixture `.cursor/mcp.json`.
- Parent `NEURON_CWD` is the practical bind for fixture-scoped B — needs a live MCP process after config change.

---

## Operator next step

1. Cursor → **Settings → Tools & MCP** → toggle **neuron** off/on (or Reload Window).  
2. `mcp.json` already points `NEURON_CWD` at `.tmp/live-mcp-ab-fixture`.  
3. Confirm: `GetMcpTools` shows Neuron again, **7 tools**, `neuron_context` present.  
4. Call `neuron_context` with a billing question → must return fixture paths + Stripe/PaymentService rule.  
5. Reply: **continue P0 FINAL MCP A/B** — then run 40 hard-traced Task runs (no product changes to pass the bench).

---

## GO criteria (current)

| Criterion | Met? |
| --- | --- |
| `MCP_PROOF = PASS` | **No** |
| `neuron_context` used by B | **No** |
| Same task set A/B | **No** (not run) |
| B ≪ broad rediscovery | **n/a** |
| B not worse on hallucinations | **n/a** |
| B success ≥ A | **n/a** |
| Brain rules followed | **n/a** |
| Hard tool-use traces | **No** |

**Overall GO: No.**
