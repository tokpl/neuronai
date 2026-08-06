# Production Readiness Report

**Product:** NeuronAI (`neuronai` on npm)  
**Harness:** `node scripts/production-readiness.mjs`  
**Machine evidence:** [`production-readiness-report.json`](../production-readiness-report.json)  
**Date:** 2026-08-06  

**Final verdict: GO WITH CONDITIONS**

---

## 1. Executive Summary

NeuronAI is reliable enough for real developer use **on TypeScript/JavaScript projects** when the golden path is followed (`neuron init` → Cursor MCP → `neuron_context` first). Packaging, offline operation, incremental analysis correctness, adversarial retrieval (0 WRONG), and graph precision (0 false CALLS) held up under the P3 harness.

Conditions:

1. **Live Cursor/LLM A/B agent evaluation is UNAVAILABLE** in this environment (no API keys). Exploration reduction is proven only by the **scripted** P2 policy (~89% fewer exploration ops), not by live model traces.
2. **Python / non-TS code intelligence** is map+lexical only (`knowledge.code` symbols/edges = 0 on the Python shape). Location answers can still be CORRECT via Project Map.
3. **Large-repo wall-clock** for no-change updates remains **walk-dominated** (~1.1s at ~10k files) even when `reanalyzed = 0`. Analysis cost is incremental; walk cost is not free.
4. **Stale Cursor MCP catalogs** can linger until the MCP process is restarted after upgrades — a UX friction, not a Brain correctness bug.

Release blockers from the harness: **none**.

---

## 2. Real-world projects tested

| Project shape | What it is | Scan | Update (0Δ) | Symbols | Edges | knowledge.json | Sample grade |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| ts-node-app | Realistic TS/Node auth+billing fixture | ~513ms | ~328ms | 12 | 37 | small | CORRECT |
| nextish | React/Next-ish app router layout | ~402ms | ~313ms | 4 | 10 | small | CORRECT |
| monorepo | pnpm workspaces apps+packages | ~453ms | ~313ms | 4 | 9 | small | CORRECT |
| python | `pyproject.toml` + `app/` services | ~420ms | ~304ms | 0 | 0 | small | CORRECT (map) |
| noisy | UI/admin/test/generated/vendor noise | ~443ms | ~318ms | 14 | 41 | ~44KB | CORRECT |
| unconventional | No package.json layout (`code/…`) | ~402ms | ~311ms | 3 | 7 | small | CORRECT |
| **this-monorepo** | NeuronAI itself (real large TS monorepo) | ~882ms | ~385ms | **396** | **1304** | **~789KB** | CORRECT |

Honest scope note: shapes are **locally constructed realistic trees** plus **this repository**. They are not clones of unrelated public OSS orgs. Prefer that honesty over claiming “benchmarked against Next.js / Django / Kubernetes.”

---

## 3. Retrieval accuracy

Adversarial suite (noisy fixture + MCP `neuron_context`):

| Grade | Count |
| --- | ---: |
| CORRECT | 12 |
| ACCEPTABLE | 1 |
| WRONG | **0** |
| NO_MATCH | 4 |

NO_MATCH cases were intentionally underspecified or negative (“Where should I modify this behavior?”, “What rule applies to this subsystem?”, Kubernetes / React Native). Preferring **no answer** over a confident wrong one is treated as success for negatives.

Prior multi-repo proof (`final-proof-report.json`): 98 CORRECT / 2 ACCEPTABLE / 0 incorrect on 100 queries.

---

## 4. Recommendation accuracy

- Auth / billing / payment / DB / route queries: recommendations landed on expected modules when graded.
- Vague queries: recommendation often `null` with NO_MATCH — acceptable.
- After `src/billing` → `src/payments-domain` rename + `--update`: **no stale `src/billing/` recommendation**; new path preferred (`afterRename.grade = CORRECT`).

---

## 5. Negative-query accuracy

| Query | Grade |
| --- | --- |
| How do I deploy this with Kubernetes? | NO_MATCH |
| Where is the React Native mobile app? | NO_MATCH |

`negWrong = 0`. No hallucinated paths into `src/` for out-of-scope product questions.

---

## 6. Code graph precision

**Rule enforced:** missing evidence ≻ false relationship.

Trust fixture (TS ESM `import … from './a.js'`, `Mystery.doThing()`, dynamic `import()`, Express route):

| Check | Result |
| --- | --- |
| False CALLS to `Mystery.*` | **0** |
| Edges without evidence | **0** |
| Low-confidence CALLS retained | **0** |
| Dynamic-import invented CALLS | **0** |
| IMPORTS for `.js` → `.ts` | **yes** (after fix) |
| CALLS `helper()` | **yes** |
| CALLS `Alpha.run()` | **no** (recall gap on compact class bodies) |
| ROUTE_TO | **1** (medium confidence, evidenced) |

This monorepo after fix: **IMPORTS 172 · CALLS 267 · EXPORTS 378 · DEFINED_IN 395** — all high confidence, **0 missing evidence**. Before the ESM resolve fix, this repo emitted **no IMPORTS/CALLS** despite hundreds of `.js` import specs.

Precision is strong. Recall is intentionally incomplete (DI, callbacks, HOF, unresolved symbols omitted).

---

## 7. Incremental correctness

At ~1k / ~5k / ~10k files:

| Approx files | Full scan | No-change `reanalyzed` | 1 / 10 / 100 change `reanalyzed` |
| ---: | ---: | ---: | --- |
| 1015 | 542ms | **0** | 1 / 10 / 100 |
| 5015 | 926ms | **0** | 1 / 10 / 100 |
| 10015 | 1256ms | **0** | 1 / 10 / 100 |

`reanalyzed_files ≈ changed_files` holds. It is **not** `≈ repository_size`.

---

## 8. Staleness correctness

| Case | Result |
| --- | --- |
| Delete `src/auth/` + `--update` | Map and `knowledge.code` auth paths cleared |
| Rename billing dir + `--update` | Context does not recommend old path |
| Corrupt `knowledge.json` | `doctor` fails; user memories in `runtime/store.json` **survived**; rescan recovers |
| Context before `init` | Friendly error: “Run: neuron init” |

---

## 9. Rediscovery reduction

**Single recommended path (enforced in templates + rules + commands):**

```text
neuron_context → open returned locations → targeted exploration
```

Conflicting slash-commands and agent-requestable rules that still named retired tools (`neuron_prepare_task`, `neuron_run_mode`, …) were rewritten during P3.

**Scripted P2** ([`docs/REAL_AGENT_BENCHMARK.md`](./REAL_AGENT_BENCHMARK.md)): baseline 5.5 → neuron 0.6 exploration ops (**−89.1%**), 0 WRONG starts. That is a **scripted policy**, not a live LLM session.

Brain compression (`contextTokens` ≪ `corpusTokens`) is reported separately and is **not** labeled “agent token savings.”

---

## 10. Live-agent results

**UNAVAILABLE** — no `CURSOR_API_KEY` / `ANTHROPIC_API_KEY` in the validation environment.

Do not treat scripted exploration as live agent usage. Do not invent agent token / completion metrics.

---

## 11. Performance

Costs separated:

| Cost | Observation |
| --- | --- |
| **WALK** | Dominates no-change updates (~0.4–1.1s from 1k→10k files) |
| **ANALYSIS** | Tracks `reanalyzed` (0 when unchanged) |
| **RETRIEVAL** | Typically **1–20ms** on fixtures; ~39ms on this monorepo sample |

No speculative optimizer was added. Bottleneck for “feels slow on large repos” is filesystem walk, not retrieval.

---

## 12. Packaging verification

Against `npm pack` → clean install:

| Check | Result |
| --- | --- |
| `scripts/verify-package.mjs` | **pass** |
| `scripts/verify-offline.mjs` | **pass** |
| Workspace runtime deps in packed CLI | **0** |
| Brain fingerprint embedded | **match** |
| init → scan → context → remember → doctor → MCP | **ok** |

The tarball is the product under test, not only the workspace.

---

## 13. Cursor UX

Golden path works when MCP points at `neuron mcp` (7 tools) and rules teach `neuron_context` first.

Friction observed / left:

| Friction | Severity |
| --- | --- |
| Stale MCP tool catalog after upgrade until restart | Medium (this IDE session still showed legacy tools until restart) |
| Historical agent-requestable rules naming ghost tools | **Fixed** in-repo |
| Stranger still needs `neuron init` before context | Intended; error is friendly |
| Windows `shell:true` deprecation noise in Node child_process | Cosmetic |

---

## 14. Critical bugs found

1. **TypeScript ESM `.js` import specs did not resolve to `.ts` files** → IMPORTS/CALLS silently absent on modern TS repos (including this monorepo).
2. **Cursor commands/rules still instructed retired MCP tools**, fighting the single understanding path.

---

## 15. Bugs fixed

1. `resolveImport` now maps `.js`/`.jsx`/`.mjs`/`.cjs` specs to on-disk `.ts`/`.tsx` (and index variants). Unit test added.
2. `.cursor/commands/*` and agent-requestable `.cursor/rules/*` rewritten to the 7-tool surface with `neuron_context` first.
3. Production harness false-negative on MCP tool count (`registerTool('neuron_…')` vs `name:` regex) corrected.

---

## 16. Bugs intentionally left

- Live agent A/B harness not run (no keys).
- Walk cost still O(files) on no-change updates.
- Compact one-line class bodies may miss method CALLS (`Alpha.run` recall gap).
- Python/other languages: no deep `knowledge.code` yet.
- Corrupted `knowledge.json` can still yield CLI `context` exit 0 after fallback paths — doctor catches it; harden further later.
- No 25k+ file soak in this run (10k proven).

---

## 17. Technical debt

- Heuristic regex analyzer (not tree-sitter/LSP) — trust-limited by design.
- Large generated trees classified MEDIUM → deep code stats stay small while walk still pays.
- Cursor install refreshes Neuron-owned templates but cannot force-kill a stale IDE MCP process.

---

## 18. Architecture problems

None requiring redesign.

Confirmed:

- ProjectBrain remains the runtime source of truth
- `knowledge.code` is the only code-intelligence store
- One retrieval path into context compilation
- MCP stays at **7 tools**; CLI and MCP share Brain APIs
- No second index / embeddings / cloud DB introduced

---

## 19. Product problems

- Live-agent proof still missing for marketing claims about agent exploration.
- Non-TS ecosystems get map help, not graph help.
- Upgrade UX depends on users restarting MCP after `neuronai` bumps.

---

## 20. Documentation problems

Docs claim audit: **0 overclaim hits** on agent-token-savings / Graft-like marketing language in the scanned files. README already separates Brain compression from agent tokens. Keep that discipline.

---

## 21. Security / privacy concerns

- Local-first; offline journey verified.
- No secrets should be stored in memories (policy in rules).
- Corrupted brain does not wipe user memories in `runtime/store.json`.
- No new network surfaces added in P3.

---

## 22. Release blockers

**None** from the P3 harness after the ESM + Cursor-path fixes.

---

## 23. Recommended next steps

1. Run a **live agent A/B** once keys exist; attach traces without renaming scripted metrics.
2. Profile **filesystem walk** if large-repo UX complaints arrive; only then optimize.
3. Optional: improve class-method extraction for compact bodies (recall only; do not loosen CALLS precision).
4. Publish with clear README conditions: TS/JS strongest; Python map-only; restart MCP after upgrade.
5. Optional soak at 25k+ files for walk-cost curves.

---

## 24. Final verdict

# GO WITH CONDITIONS

NeuronAI can be installed into an unfamiliar **TypeScript/JavaScript** repository tomorrow and, when Cursor uses the packaged 7-tool MCP, will reliably point agents at where to look, what is connected (verified edges only), which rules apply, and where to start — **without manufacturing relationships or hallucinating negative-query locations**.

Conditions: live LLM agent proof still pending; non-TS depth limited; large-repo updates pay walk cost; restart MCP after upgrades.

Reproduce:

```bash
pnpm --filter neuronai build
node scripts/production-readiness.mjs
```

Evidence artifacts: `production-readiness-report.json`, `real-agent-benchmark-report.json`, `deep-code-proof-report.json`, `final-proof-report.json`.
