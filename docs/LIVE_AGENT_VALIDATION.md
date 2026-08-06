# Live agent validation

**Date:** 2026-08-06  
**Evidence:** [`live-agent-validation-report.json`](../live-agent-validation-report.json), [`mcp-integration-report.json`](../mcp-integration-report.json)

---

## Three proofs (do not mix)

| Label | Status | Meaning |
| --- | --- | --- |
| `STDIO_MCP_PROOF` | **PASS** | Fixture + monorepo: `tools/list` = 7 product tools; `neuron_context` callable |
| `CURSOR_MCP_PROOF` | **MANUAL GATE** | Reload Cursor MCP; confirm 7 tools + callableable `neuron_context` |
| `LIVE_AGENT_PROOF` | **UNAVAILABLE** | Final 20×2 A/B blocked until `CURSOR_MCP_PROOF` |

---

## Verdict (live agent)

# PROMISING BUT UNPROVEN

Do **not** run the final live A/B until Cursor shows and invokes `neuron_context`.

---

## P0 — Cursor MCP integration reliability

### Problem

```text
stdio MCP on fixture:     PASS (neuron_context + rules/paths)
Cursor Task / this chat:  neuron_context missing from catalog
                          CallMcpTool → -32602 Tool not found
```

### Root cause

**C — stale Cursor IDE tools/list** (primary): live process is current `apps/cli/dist … mcp` (7 tools); IDE catalog still advertises retired names (`neuron_prepare_task`, `neuron_get_context`, …). Invoke hits the live server → `-32602`.

**D — Task harness limitation** (secondary): Cursor Task in this workspace reuses parent MCP (`project-0-neuron-ai-memory-neuron`) and does **not** load nested `.tmp/mcp-proof/.cursor/mcp.json`.

Not A (unknown forever), B (bad args), E (schema), F (handshake), or G (`NEURON_CWD`) for the product binary.

### Fix

- **Product binary/config:** already correct — no architecture change.
- **Operator:** Cursor Settings → Tools & MCP → toggle **neuron** off/on (or Reload Window).
- **Doctor:** distinguishes `Tool catalog (stdio binary)` vs `Cursor IDE catalog` (manual gate).
- **Regression:** `scripts/mcp-proof-stdio.mjs`, `apps/mcp-server/tests/mcp-stdio-surface.test.ts`.

### Why it works (stdio)

Same command/args/env as generated `.cursor/mcp.json` → exact 7 tools → `neuron_context` returns payment paths + Stripe/PaymentService rule.

### Fresh / Existing / Reload / Generated

| Case | MCP visible | neuron_context | Call works |
| --- | --- | --- | --- |
| Fresh Cursor | UNAVAILABLE (manual) | UNAVAILABLE | UNAVAILABLE |
| Existing (this session) | YES (stale) | NO | NO (−32602) |
| Reload | UNAVAILABLE until you toggle | — | — |
| Generated + stdio | N/A | YES | YES |

### Real project

`neuron cursor doctor` → stdio tool catalog **PASS**. IDE catalog still needs reload in this session.

### Acceptance before final 20×2

```text
CURSOR_MCP_VISIBLE     = PENDING_RELOAD
NEURON_CONTEXT_VISIBLE = PENDING_RELOAD
NEURON_CONTEXT_CALL    = PENDING_RELOAD
FRESH_PROCESS          = MANUAL
GENERATED_CONFIG       = PASS
REAL_PROJECT (stdio)   = PASS
```

After you reload MCP in Cursor, re-check that chat/`GetMcpTools` shows `neuron_context` and a call succeeds — then we run final live A/B.

---

## Earlier wave1 notes (CLI / hard traces — not MCP proof)

See git history / prior report sections. Self-reported rediscovery was optimistic vs transcript `tool_use`. CLI is **not** a substitute for `CURSOR_MCP_PROOF`.
