# FINAL RELEASE AUDIT — NeuronAI

**Date:** 2026-08-06  
**Evidence:** [`final-release-audit-report.json`](../final-release-audit-report.json), [`live-agent-mcp-report.json`](../live-agent-mcp-report.json), [`p4-validation-report.json`](../p4-validation-report.json)

---

## 1. Executive verdict

# RELEASE WITH CONDITIONS

NeuronAI is a **credible, installable, local-first developer product**. The core claim — Cursor agents can call real MCP `neuron_context` and then explore with less broad rediscovery while keeping task success — is supported by **hard tool-use traces** on 40 runs.

It is **not** a claim of universal token/latency savings, Graft replacement, or guaranteed improvement on every repo/workflow.

**Product code was not changed to pass this audit** (except correcting a stale report script label and scrubbing accidental payment memories from this workspace’s `.neuron` that were introduced during earlier fixture experiments).

---

## 2. Architecture invariants

| Invariant | Status |
| --- | --- |
| Single path Cursor → MCP → `neuron_context` → ProjectBrain → retrieval → recommendation → connected slice → compiler → compact context | **HOLD** |
| One ProjectBrain | **HOLD** (`packages/brain`, `openProjectBrain`) |
| One retrieval path | **HOLD** (`packages/brain/src/retrieval/rank.ts` via storage runtime) |
| One `knowledge.json` plane (includes `knowledge.code`) | **HOLD** — code intelligence is **not** a second index |
| Primary MCP entry: `neuron_context` | **HOLD** |
| Exactly 7 MCP tools | **HOLD** (`TOOL_NAMES` + stdio `tools/list` + vitest) |
| No embeddings / vector DB | **HOLD** |
| No hidden cloud / telemetry at runtime | **HOLD** (`pnpm verify:offline` PASS) |

Canonical flow remains:

```text
Cursor → neuron mcp (stdio) → neuron_context → ProjectBrain
  → retrieve → recommend / expand verified edges → BrainCompiler → compact markdown
  → agent targeted reads
```

**Release blocker?** No invariant violation found.

---

## 3. Live MCP evidence

| Label | Status |
| --- | --- |
| `MCP_PROOF` | **PROVEN** |
| `LIVE_AGENT_PROOF` | **MEASURED** |

Hard ledger (recalculated from `live-agent-mcp-report.json` transcripts):

| Metric | A | B | Δ |
| --- | ---: | ---: | ---: |
| runs | 20 | 20 | — |
| exploration median | **8.5** | **5** | −3.5 (**−41.2%**) |
| exploration mean | 9.9 | 6.55 | −3.35 (**−33.8%**) |
| file reads median | **11.5** | **8** | −3.5 (**−30.4%**) |
| file reads mean | 11.25 | 8.15 | −3.10 (**−27.6%**) |
| `neuron_context` MCP calls | 0/20 | **20/20** | — |
| B rediscovery violations | — | **0** | — |
| B MCP-before-explore | — | **20/20** | — |
| task success | 100% | 100% | — |
| hallucinated fixture paths | 0 | 0 | — |

```text
TOKEN_SAVINGS = UNAVAILABLE
AGENT_LATENCY = UNAVAILABLE
```

Verified published figures match raw recalculation.

---

## 4. Benchmark methodology audit

### Valid evidence

- **A isolation:** 0/20 A runs called `neuron_context` (hard `toolName` ledger).
- **B real MCP:** 20/20 B runs invoked Cursor `CallMcpTool` → `neuron_context` (not CLI).
- **Order:** 20/20 B started with `GetMcpTools` / `CallMcpTool` before Grep/Glob/Read.
- **Same workspace:** both arms used `c:\projekty\neuron-ai-memory` (real configured project MCP).
- **Same task set:** 20 monorepo engineering tasks × A/B.
- **Scoring:** subagent JSONL `tool_use`, not self-report; not scripted −89%.

### Methodological limitations (do not invalidate; reduce generality)

| Issue | Impact |
| --- | --- |
| **B was instructed** to call `neuron_context` first | Adoption 20/20 measures **protocol compliance + MCP function**, not organic discovery of the tool |
| **Sample size n=20** tasks, **one repo** (Neuron monorepo) | Exploration reduction is **measured**, not universal |
| **Prompt asymmetry** (A forbids MCP; B requires it) | Intentional A/B design; not hidden leakage of file contents |
| **Success grading** uses gold substring match | Generous; both arms still 100% on this set |
| **Not payments-fixture MCP** | Correct for “real installed path”; Task cannot attach nested fixture MCP (harness limitation D) |
| **p4 `LIVE_AGENT_PROOF=UNAVAILABLE`** | That script checks API keys for a *different* harness; **canonical live proof is `live-agent-mcp-report.json`** |

### Contamination found & cleaned

This workspace’s `.neuron/brain/knowledge.json` contained **accidental PaymentService / Stripe route rules** from earlier fixture seeding against the wrong CWD. Those memories are **false for this monorepo**. Removed (2 entries) during audit. Fresh installs are unaffected.

### Invalid evidence? 

**No.** Do not treat scripted `EXPLORATION_POLICY_PROOF` (~89%) as live-agent proof. Live MCP proof stands on its own with smaller, honest deltas.

---

## 5. Retrieval quality

| Suite | Result |
| --- | --- |
| Daily-use audit (`pnpm validate:p4`) | **31 CORRECT / 0 WRONG / 1 NO_MATCH** (≥90% gate) |
| Mutation rename/delete | **PASS** (`renameStale=false`, `deleteStale=false`, `userRule=true`) |
| Context quality (connected slice) | start+rules; negative empty |
| Brain unit tests | **58/58 PASS** |
| MCP surface tests | **12/12 PASS** |
| Monorepo CLI `neuron context` location queries | Often returns **decisions/knowledge without Recommended start paths** (`relevantFiles: []`) — useful but weaker UX than payment fixtures |

**Python:** map-oriented / shallow (not deep call-graph) — do not claim otherwise.

**Retrieval ms** on audited CLI calls: ~3–14 ms (fixture/target &lt;20 ms on comparable loads). Not a universal SLA.

---

## 6. Mutation / staleness / user memory

From P4 mutation section (fixture billing→payments rename/delete):

- Stale scan-derived paths cleared
- User rule survived
- Aligns with documented semantics: scan-derived knowledge carries paths; user memories not auto-deleted

---

## 7. Incremental behavior

Documented and previously proven at ~10k:

> Deep reanalysis scales with the changed set; repository walking remains O(n).

Storage incremental tests **PASS**. P4/production docs separate WALK vs ANALYSIS. **Do not** claim wall-clock ∝ changed files only.

This audit did **not** re-soak a fresh 10k corpus (prior evidence accepted; not a blocker).

---

## 8. Packaging / offline

| Gate | Result |
| --- | --- |
| `pnpm verify:package` | **PASS** (stranger install, brain fingerprint `0.2.0@5da4f29ab6e5`, no workspace `@neuronai/*` runtime deps) |
| `pnpm verify:offline` | **PASS** |
| `pnpm verify:mcp` | **PASS** stdio 7 tools + callable `neuron_context` |
| `pnpm validate:p4` | **READY WITH CONDITIONS** |

---

## 9. Cursor integration

| Check | Result |
| --- | --- |
| Fresh stdio: exactly 7 tools | **PASS** |
| `neuron_context` present; legacy names absent from product `TOOL_NAMES` | **PASS** |
| Rules instruct call-before-explore | **PASS** (`.cursor/rules`, tool description) |
| Doctor: stdio vs IDE catalog / reload / git HEAD | **PASS** (P4 doctor HEAD awareness) |
| IDE catalog can go stale after upgrades | **CONDITIONAL** — user must reload MCP |

---

## 10. Security / trust

| Check | Finding |
| --- | --- |
| Offline / no network runtime | **PASS** |
| Secrets in context | No systematic leak found in audited path; brain is local JSON |
| Path traversal via retrieval | Retrieval ranks stored paths; does not read arbitrary disk outside project brain/cwd model |
| MCP tool surface | Fixed 7 tools; no shell exec via retrieval |
| Scan invalidation vs user memory | User memories preserved on mutation fixture |
| Generated/vendor overwhelm | Ranking prefers core modules (prior suites); monitor in large monorepos |

No release-blocking security defect found in this pass.

---

## 11. Documentation claims

| Claim type | Status |
| --- | --- |
| README Brain compression vs whole-brain paste | **OK** — not sold as agent token bill savings |
| Scripted ~89% exploration | Labeled `EXPLORATION_POLICY_PROOF` — **must not** be called live-agent |
| Live MCP −41% explore median / −30% reads median | **OK** to cite with n=20, one repo, protocol-prompted B |
| Graft replacement | **Not claimed** in README (good) |
| Stale `mcp-integration-report` LIVE_AGENT=UNAVAILABLE | **Fixed** to prefer `live-agent-mcp-report.json` |

---

## 12. Proven / indicated / unproven

### PROVEN

- Real Cursor MCP `neuron_context` works (7-tool surface)
- 20/20 B agents called `neuron_context` (hard ledger)
- 0/20 A called Neuron MCP
- 0 B rediscovery-order violations in this benchmark
- Exploration median 8.5 → 5; file-read median 11.5 → 8
- Task success maintained 100%/100% on this set
- 0 hallucinated fixture payment paths in the benchmark
- Packed npm install works offline-capable; brain fingerprint embedded
- Daily-use fixture retrieval ≥90% correct with 0 wrong fabricated locations in that suite

### STRONGLY INDICATED

- Neuron reduces broad rediscovery when agents follow the MCP-first protocol
- Compact ProjectBrain context helps modification/debug tasks (fixture + live)
- Connected-slice recommendations work on TS/JS payment-style fixtures

### NOT PROVEN

- Exact token or LLM cost savings
- Exact agent latency reduction
- Universal improvement across all repositories / Cursor workflows
- Organic tool discovery without prompting
- Python deep intelligence
- Superiority over / replacement of Graft
- Long-term productivity gains

---

## 13. NeuronAI vs Graft (honest)

| NeuronAI | Graft-style strengths |
| --- | --- |
| ProjectBrain, rules/decisions/user memory | Richer structural code graph |
| MCP-first compact context | Call-graph depth, skeletons, summaries |
| Verified edges only (prefer missing over wrong) | Blast-radius style analysis |
| Offline, no embeddings | — |

**Do not** document Neuron as a full Graft replacement. Complementary, not identical.

---

## 14. Remaining limitations (user-facing)

1. After upgrading Neuron, **reload Cursor MCP** if tools look wrong or `-32602` appears.
2. Value depends on agents calling **`neuron_context` before broad exploration** (rules + discipline).
3. Live exploration gains measured on **20 tasks / one monorepo** — expect variance elsewhere.
4. Best structural intelligence on **TypeScript/JavaScript**; Python is shallower.
5. Large-repo **walk** cost remains O(n) even when `reanalyzed=0`.

---

## 15. Scorecard

| Area | Status |
| --- | --- |
| MCP_PROOF | **PASS** |
| LIVE_AGENT_PROOF | **PASS** (MEASURED) |
| RETRIEVAL | **PASS** (fixtures); **CONDITIONAL** (sparse Recommended start on this monorepo) |
| MODIFICATION | **PASS** |
| NEGATIVE_HALLUCINATION | **PASS** |
| INCREMENTAL | **PASS** (documented + unit; 10k soak not re-run this audit) |
| RENAME_DELETE | **PASS** |
| USER_MEMORY | **PASS** |
| PACKAGING | **PASS** |
| OFFLINE | **PASS** |
| CURSOR | **CONDITIONAL** (reload after upgrade) |
| SECURITY | **PASS** |
| DOCS | **CONDITIONAL** (keep live vs scripted labels strict) |

---

## 16. Release recommendation

**RELEASE WITH CONDITIONS**

NeuronAI meets the bar for a real developer product whose **core MCP + ProjectBrain claim is evidence-backed**, with clear user conditions and without overclaiming tokens, latency, or Graft parity.

**Not READY?** No — no architecture/invariant/packaging/security blocker found that prevents release.

---

## 17. Stop

No P5. No embeddings. No new MCP tools. No second index. No roadmap expansion in this audit.
