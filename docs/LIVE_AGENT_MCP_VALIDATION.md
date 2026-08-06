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

### Critical caveats (valid evidence ≠ unlimited claims)

- B was **instructed** to call `neuron_context` first → 20/20 adoption proves MCP + protocol compliance, not organic discovery.
- Sample = **one repo**, **n=20** tasks → measured exploration reduction, not universal productivity.
- Do **not** cite scripted ~89% `EXPLORATION_POLICY_PROOF` as this live MCP result.
- Honest live deltas: explore median **−41.2%** (8.5→5); reads median **−30.4%** (11.5→8).
- See [`FINAL_RELEASE_AUDIT.md`](FINAL_RELEASE_AUDIT.md) for release verdict.

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
