# Live agent MCP validation (P0 FINAL)

**Date:** 2026-08-06  
**Evidence:** [`live-agent-mcp-report.json`](../live-agent-mcp-report.json)

## Labels

| Label | Status |
| --- | --- |
| `MCP_PROOF` | **PROVEN** |
| `LIVE_AGENT_PROOF` | **MEASURED** |
| B `neuron_context` in hard ledger | 20/20 (100%) |
| B explore median ≤ A | true |
| B success ≥ A | true |



## Acceptance gate

**PASS** — workspace MCP (`NEURON_CWD` = monorepo). No fixture bind. No product changes during A/B. MCP process left running.

## Methodology

- **A:** Neuron MCP forbidden; normal exploration  
- **B:** real Cursor `CallMcpTool` → `neuron_context` first, then targeted reads  
- **20 tasks × 2 arms = 40 runs** on this monorepo  
- Evidence = subagent JSONL `tool_use` (not self-report, not CLI `neuron context`)  
- Token/latency: **UNAVAILABLE**

## A/B metrics (hard traces)

| Metric | A | B | Δ (B−A median) |
| --- | ---: | ---: | ---: |
| runs scored | 20 | 20 | |
| exploration ops (sum) | 198 | 131 | |
| exploration ops (median) | 8.5 | 5 | -3.5 |
| file reads (sum) | 225 | 163 | |
| file reads (median) | 11.5 | 8 | -3.5 |
| rediscovery ops (sum) | 144 | 90 | |
| task success rate | 100% | 100% | |
| hallucinated fixture paths | 0 | 0 | |
| B rediscovery violations | — | 0 | |

## Harness limitation

Cursor Task reuses parent workspace MCP and does not load nested fixture `.cursor/mcp.json`. This proof uses the **real installed workspace MCP**, not a payments fixture bind. Product was not changed to work around that.

## Per-task

See `live-agent-mcp-report.json` → `perTaskResults`.
