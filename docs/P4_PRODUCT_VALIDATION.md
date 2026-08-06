# P4 — Product Validation & Production Hardening

**Date:** 2026-08-06  
**Evidence:** [`p4-validation-report.json`](../p4-validation-report.json), [`live-agent-benchmark-report.json`](../live-agent-benchmark-report.json), [`daily-use-audit-report.json`](../daily-use-audit-report.json)

---

## 1. Product verdict

# READY WITH CONDITIONS

NeuronAI is trustworthy enough to keep installed on TypeScript/JavaScript projects: zero-config init, offline, packed npm, useful `neuron_context`, mutation-safe brain updates, and doctor warnings when Git HEAD moves without a rescan.

**Conditions:**

1. `LIVE_AGENT_PROOF = UNAVAILABLE` — infrastructure exists; no invented traces  
2. Scripted exploration (−89%) is `EXPLORATION_POLICY_PROOF`, not live agent savings  
3. Restart/toggle Cursor MCP after upgrades  
4. Best experience remains TS/JS (Python map-only)  
5. Team `knowledge.json` merge conflicts still need human care  

---

## 2. What a stranger experiences

```bash
npm install -g neuronai
cd my-project
neuron init
```

Then:

1. Enable **neuron** in Cursor → Settings → Tools & MCP  
2. If upgrading: toggle MCP off/on (or restart Cursor) so the 7-tool catalog refreshes  
3. Ask the coding agent to change something — or run `neuron context "…"` locally  
4. `neuron doctor` for health / freshness / HEAD drift  

Init prints Detected / Brain / Cursor / Next. No API key. No cloud. No config wizard.

---

## 3. What the agent experiences

```text
Developer prompt
  → Cursor rule: call neuron_context first
  → ProjectBrain retrieve → recommend → connected slice → compile
  → compact markdown (Recommended start · Related · Depends on · Rules · Decisions · Where to look)
  → agent opens returned paths only
```

P4 context sample (“Add support for cancelling invoices”):

- Recommended start: present  
- Rules: present  
- ~272 tokens  
- retrieval ~14ms  
- Negative “Where is Terraform?”: empty / no fabrication  

---

## 4. Measured retrieval quality

Daily-use suite (re-run in P4 gate):

| Grade | Count |
| --- | ---: |
| CORRECT | 31 |
| ACCEPTABLE | 0 |
| WRONG | **0** |
| NO_MATCH | 1 |

Hallucinated locations / relationships in P4 checks: **0**.

Mutation suite: rename `billing→payments` clears stale paths; delete drops old files; user Stripe rule survives.

---

## 5. Measured agent exploration

| Label | Result |
| --- | --- |
| `LIVE_AGENT_PROOF` | **UNAVAILABLE** |
| `EXPLORATION_POLICY_PROOF` | Prior scripted harness (~89% fewer exploration ops) — see `docs/REAL_AGENT_BENCHMARK.md` |

Harness for live A/B: `scripts/live-agent-benchmark.mjs` (32 tasks, metrics schema). Credentials alone do **not** invent traces; runner must be implemented honestly later.

---

## 6. Performance

| Check | Result |
| --- | --- |
| Retrieval on P4 fixture | ~14ms (&lt;20ms target) |
| Daily-use avg retrieval | ~2.5ms |
| Incremental reanalyzed ≈ changed | Confirmed in prior P3 (1k–10k) |
| 50k soak | **Not run** this phase |

Walk cost on large no-change updates remains O(n files) — documented, not rewritten.

---

## 7. Packaging

`verify-package`: **pass** (packed tarball stranger path)  
`verify-offline`: **pass**

---

## 8. Offline

Full init/scan/search/doctor journey with network blocked: **pass**.

---

## 9. Remaining risks

- Cursor stale MCP catalog until reload  
- Live agents may still ignore `neuron_context` if rules aren’t loaded  
- Git merge of `.neuron/brain/knowledge.json` can conflict on teams  
- Heuristic analyzer: missing edges preferred over false ones — recall incomplete  
- Global `-g` install still needs per-project `neuron init`

---

## 10. Features deliberately NOT built

| Rejected | Why |
| --- | --- |
| Embeddings / vector DB | Fashion, not proven need |
| New MCP tools (`neuron_impact`, …) | `neuron_context` expresses the need |
| Python deep intelligence | Excel at TS/JS first |
| Cloud / telemetry / API keys | Violates product identity |
| 50k scanner rewrite | No measured user-visible failure requiring it |
| Autonomous agent / chat UI | Out of scope |

**What P4 did ship (trust, not features):**

- Git HEAD recorded on scan; doctor flags drift → `neuron scan --update`  
- Init next-steps spell out MCP reload  
- Live-agent benchmark scaffolding + honest UNAVAILABLE reporting  
- README metric labels (MEASURED / SIMULATED / UNAVAILABLE)  
- `pnpm validate:p4` / `benchmark:live` / `benchmark:scripted`

---

## 11. Final recommendation

> If this were your own open-source project, would you keep NeuronAI installed permanently?

**Yes — on TypeScript/JavaScript repos**, with eyes open: restart MCP after upgrades, treat scripted −89% as direction not gospel, and run `neuron doctor` when switching long-lived branches.

**Not yet a blind “always”** for Python-heavy monorepos, or for teams that refuse to commit/reconcile `.neuron/brain/`.

The product is closer to infrastructure when:

```text
I stopped thinking about NeuronAI. My coding agent just knows where to start.
```

That is achievable today for TS/JS + Cursor when the MCP catalog is current. Live multi-turn proof remains the honest missing piece.

---

Reproduce:

```bash
pnpm verify
pnpm validate:p4
pnpm benchmark:live   # writes LIVE_AGENT_PROOF = UNAVAILABLE without inventing traces
```
