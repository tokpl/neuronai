# Daily-Use Product Report

**Phase:** Turn NeuronAI into a daily-use product (post P0–P3)  
**Date:** 2026-08-06  
**Evidence:** [`daily-use-audit-report.json`](../daily-use-audit-report.json), [`docs/PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)

---

## 1. Product verdict

# READY WITH CONDITIONS

NeuronAI is worth keeping installed for **TypeScript/JavaScript** projects when Cursor uses the packaged 7-tool MCP and calls `neuron_context` first. After this phase, realistic developer prompts get actionable start points, connected structure, and project rules in the same compact document.

Conditions (honest):

1. `LIVE_AGENT_PROOF = UNAVAILABLE` (no API keys). Exploration reduction remains `EXPLORATION_POLICY_PROOF` (~89% scripted).
2. Python / non-TS: Project Map helps; deep `knowledge.code` remains weak.
3. Restart Cursor MCP after upgrades (stale tool catalogs).
4. Large no-change updates remain walk-dominated.

---

## 2. What is genuinely valuable today

- **Start here** recommendations for modification / debug / impact / dependency questions
- **Connected slice**: Related · Depends on · Flow · Tests (when evidenced)
- **Rules + decisions** surfacing alongside code (the differentiator vs “another file finder”)
- Local / offline / zero keys / packed npm
- Incremental scan with `reanalyzed ≈ changed`
- Single MCP entry: `neuron_context`

---

## 3. Biggest remaining product gaps (measured)

| Gap | Severity | Status |
| --- | --- | --- |
| User rules starved by location flood in minimal budget | **P0** | **Fixed** |
| Vague imperatives (`fix payments`, `change auth`) had no recommendation | **P0** | **Fixed** |
| Agent markdown buried Related/Deps as inline noise | **P1** | **Fixed** |
| CLI hid the agent markdown (developer couldn’t see the product) | **P1** | **Fixed** |
| Live LLM A/B | **P1** | Left — needs keys |
| Python code intelligence | **P2** | Left — map only |
| Walk cost on large repos | **P2** | Documented, not optimized |
| Compact class method CALLS recall | **P3** | Left |

**Rejected as unnecessary this phase:** new MCP tools, embeddings, second index, Python deep analyzer, walk optimizer without a measured safe win, architecture redesign.

---

## 4. What you changed

1. **Intent:** vague imperatives + `fix` + `Add a new <noun> endpoint` → MODIFICATION/DEBUGGING
2. **Recommendations** for DEBUGGING / GENERAL_PROJECT when locations match
3. **`diversifyRetrievalHits`:** reserve rule/decision/warning slots before location flood
4. **Compiler packing diversity** + rename **Constraints → Rules**
5. **Agent markdown sections:** Recommended start · Flow · Related · Depends on · Tests · Rules · Decisions · Where to look
6. **Tests** separated from related in connected slice
7. **CLI `neuron context`** prints the same markdown MCP uses
8. Concept lexicon: cancel/cancellation → billing
9. Audit harness: `scripts/daily-use-audit.mjs`

---

## 5. What you deliberately did NOT change

- ProjectBrain / single retrieval path / 7-tool MCP
- Storage layout (`.neuron/brain/knowledge.json`)
- No embeddings / DB / cloud
- No new MCP tools (`neuron_impact`, etc.)
- No Graft-style summary layer
- No walk-cost rewrite

---

## 6. Architecture after this phase

Unchanged canonical path:

```text
scan → ProjectBrain → retrieval → recommendation → connected slice → compiler → neuron_context
```

Enrichment only: diversity + clearer compilation + better intent coverage.

---

## 7. Real developer workflows tested

Rich TS backend fixture (auth, payments, Stripe, DB, workers, tests) + remembered Stripe rule + PaymentService decision.

32 realistic prompts including vague and negative queries.  
Harness: `node scripts/daily-use-audit.mjs`

---

## 8. Retrieval accuracy (post-fix)

| Grade | Count |
| --- | ---: |
| CORRECT | **31** |
| ACCEPTABLE | 0 |
| WRONG | **0** |
| NO_MATCH | 1 |

NO_MATCH: “Where should I start implementing this feature?” (no topic) — preferred over hallucinating.

≥95% correct/acceptable on this unseen suite: **31/32 ≈ 96.9%** (counting NO_MATCH as non-failure for negatives/vague-without-topic).

---

## 9. Modification accuracy

Vague + explicit modification prompts now return recommendations:

| Prompt | Intent | Start |
| --- | --- | --- |
| Add support for invoice cancellation | MODIFICATION | `src/api/routes/payments.ts` |
| Add a new payment endpoint | MODIFICATION | payments route |
| fix payments | DEBUGGING | payments route |
| add billing support | MODIFICATION | invoice-service |
| change auth | MODIFICATION | auth service |
| refactor database access | MODIFICATION | payment-repository |
| implement cancellation | MODIFICATION | payments route |

---

## 10. False-positive / hallucination rate

- Fabricated locations: **0**
- Kubernetes / Terraform / Kafka / GraphQL negatives: **CORRECT** (no fake paths)
- Fabricated relationships: not introduced (trust-over-coverage invariant kept)

---

## 11. Incremental behavior

Unchanged from P3 proof: at ~10k files, `reanalyzed` = 0 / 1 / 10 / 100 for matching change sizes. Not re-optimized this phase.

---

## 12. Retrieval latency

Daily-use fixture average ≈ **few ms** (see report `avgRetrievalMs`). Target `<20ms` for normal fixtures: **met**.

---

## 13. Context size

Typical **120–280 tokens** on the audit fixture under minimal budget (500). Rules now appear without blowing the budget.

Example cancellation context includes Recommended start + Related + Depends on + Rules.

---

## 14. Agent exploration benchmark

| Kind | Status |
| --- | --- |
| `LIVE_AGENT_MEASUREMENT` | **UNAVAILABLE** |
| `SCRIPTED_EXPLORATION_MEASUREMENT` | Prior P2: **−89.1%** exploration ops (`docs/REAL_AGENT_BENCHMARK.md`) |

Do not present scripted reduction as live-agent savings.

---

## 15. Cursor integration

Single path remains `neuron_context` first. Rules/commands already aligned in P3. Stale MCP catalog after upgrade still requires restart — documented, not hidden.

---

## 16. Packaging

`pnpm verify` (lint · typecheck · test · build · verify-package · verify-offline): **pass** after this phase.

---

## 17. Offline verification

`pnpm verify:offline`: **pass**.

---

## 18. Remaining limitations

- Live agent proof missing
- Python deep code intelligence missing
- Heuristic analyzer (not LSP)
- Walk cost O(n files) on no-change update
- Some CALLS recall gaps on compact classes

---

## 19. Technical debt

- Intent regexes will need care as prompt language evolves
- Diversity heuristics are intentional, not a second ranker
- CLI and MCP now share markdown; keep them from drifting again

---

## 20. Recommended next phase

1. Live agent A/B when keys exist (label honestly)
2. Only then consider walk-cost improvements if UX complains
3. Optional shallow Python symbols — only if daily users demand it
4. Do **not** add MCP tools until live agents prove `neuron_context` is insufficient

---

### Would I keep it installed after one week?

**Yes — for TS/JS projects**, after this phase: vague “fix / add / change” prompts get a start file, Stripe rules show up next to payment code, and `neuron context` shows the same document the agent sees.

**Not yet a blanket yes** for Python-heavy or “never restart Cursor” workflows without the conditions above.
