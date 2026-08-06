# Real agent effectiveness benchmark (P2)

**Question:** Does Project Brain measurably reduce the work an AI coding agent has to perform to understand an unfamiliar codebase?

**Latest run:** see [`real-agent-benchmark-report.json`](../real-agent-benchmark-report.json)  
**Harness:** `node scripts/real-agent-benchmark.mjs`

---

## 1. Methodology

Two arms run the **same 20 tasks** on the **same fixture**:

| Arm | Policy |
| --- | --- |
| **A — Baseline** | Cold rediscovery: `list_dir` → `rg -l` keywords → open hits (blind until gold path) |
| **B — NeuronAI** | `neuron_context` first → open returned paths → limited `rg` fallback only on miss |

### What this is

A **scripted coding-agent exploration policy** with **observable** operations (`list_dir`, `rg`, file reads). Operations are executed for real against the fixture filesystem.

### What this is not

- Not a live Cursor / Claude / Codex multi-turn agent session
- Not SWE-bench
- Not a claim about billed model tokens

Live LLM agent traces require API credentials and a live harness. In the environment used for this report:

```text
CURSOR_API_KEY / ANTHROPIC_API_KEY → unset
agent_tokens → UNAVAILABLE
agent_llm_latency → UNAVAILABLE
```

### Metrics kept separate

| # | Metric | Source |
| --- | --- | --- |
| 1 | Brain compression | `neuron_context` metrics (`contextTokens` / `corpusTokens`) |
| 2 | Agent exploration avoided | Counted `list_dir` + `rg` + `blind_read` |
| 3 | Agent tokens | **UNAVAILABLE** (no live agent) |
| 4 | Agent latency | **UNAVAILABLE** (LLM wall-clock); retrieval ms is Brain-only |
| 5 | Correctness | Gold-path grading of opens / recommendations |

**Never** label Brain compression as “agent token savings”.

---

## 2. Environment

- Node (see report `environment.node`)
- Built `neuronai` CLI (`apps/cli/dist/index.js`)
- `rg` (ripgrep) on PATH
- Temp fixture under OS tmpdir (deleted after run unless `--keep`)

Reproduce:

```bash
pnpm --filter neuronai build
node scripts/real-agent-benchmark.mjs
```

---

## 3. Tasks (20)

Categories: location (5), modification (5), dependency/impact/flow (5), rules (3), negative (2).

Examples:

- Where is authentication implemented?
- Add invoice cancellation.
- What depends on BillingService?
- What rule applies when modifying payments?
- How does Kubernetes deployment work in this project? *(must not hallucinate)*

Full list: `report.tasks` in the JSON.

---

## 4–5. Baseline vs NeuronAI (latest aggregates)

| | Baseline | NeuronAI |
| --- | ---: | ---: |
| Avg exploration ops | **5.5** | **0.6** |
| Avg file reads | (see JSON) | (see JSON) |
| Avg op index of first useful file | **4.6** | **2.3** |
| Starting point CORRECT / ACCEPTABLE / WRONG | — | **19 / 1 / 0** |
| Answer correct / partial / incorrect | — | **19 / 1 / 0** |

Per-task rows: `report.results`.

---

## 6. Rediscovery reduction

```text
baseline: 5.5 exploration operations (avg)
neuron:   0.6 exploration operations (avg)

reduction: 89.1%
```

Counted as exploration: `list_dir`, `rg`, `blind_read` only.  
`neuron_context` and opens of Brain-returned paths are **not** counted as rediscovery.

---

## 7. Time to first useful file

Unit: **operation index** until the first gold-path file is opened (not wall-clock).

```text
baseline avg: operation 4.6
neuron avg:   operation 2.3
delta:        ~2.3 fewer ops
wall_clock:   UNAVAILABLE
```

Typical Neuron path: `neuron_context` → open recommended file.

---

## 8. Correctness

Neuron arm (latest):

| | Count |
| --- | ---: |
| correct | 19 |
| partially correct | 1 |
| incorrect | 0 |
| starting CORRECT | 19 |
| starting ACCEPTABLE | 1 |
| starting WRONG | 0 |

Negatives: no Kubernetes / Terraform / Lambda locations invented.

---

## 9. File-read reduction

See `report.file_read_reduction` (baseline avg vs neuron avg, %). Blind reads drop sharply because Neuron opens named paths instead of hunting via `rg`.

---

## 10. Token measurements

```text
agent_tokens: UNAVAILABLE

Brain compression (avg, from neuron_context):
  context tokens:  ~145
  corpus tokens:   ~4530
  compression:     ~41×
  baseline label:  whole-brain-verbatim

→ Brain compression — not measured agent token savings.
```

---

## 11. Failures

Latest run: **0** tasks with incorrect answers or WRONG starting points.  
One ACCEPTABLE start (Stripe location recommended a related payments path rather than the exact `stripe.ts` file).

---

## 12. Limitations

1. Scripted policy ≠ live LLM tool-use policy (agents may explore more or less).
2. Fixture is realistic but synthetic; private monorepos may differ.
3. No agent session token or LLM latency numbers without a live harness.
4. Baseline heuristic is intentionally “cold rediscovery,” not an optimized human.

---

## 13. Reproducibility

```bash
pnpm --filter neuronai build
node scripts/real-agent-benchmark.mjs
# optional: node scripts/real-agent-benchmark.mjs --keep
```

Requires: Node ≥ 22, ripgrep (`rg`), built CLI.

To extend to **live** agents later: set `CURSOR_API_KEY`, add an SDK arm that records real tool events — do not invent those numbers here.

---

## 14. Final verdict

```text
PRODUCT IMPACT: STRONG
```

**Why (honest):** Under this scripted exploration policy, Project Brain cut measured rediscovery ops by ~89%, reached the first useful file ~2 ops earlier, and produced correct/acceptable starts on all 20 tasks with no negative hallucinations.

**Caveat:** This proves reduced **structural rediscovery work** for an agent-like tool policy. It does **not** yet prove the same magnitude on live Cursor/Claude sessions (no API key / live traces in this run).

### Strongest use cases (from this suite)

- Location + modification (“where / where should I…”)
- Dependency / impact when Code Intelligence + map return paths
- Negatives stay empty

### If live agents later disagree

Do not add architecture. Re-run with real tool traces and adjust ranking/context packing only where measured misses appear.

---

## Architecture constraint (unchanged)

```text
Cursor → neuron_context → ProjectBrain → retrieval → CodeIntelligence / Map / Knowledge
       → compiler → compact context
```

No second retrieval engine, index, MCP tools, database, cloud, or embeddings were added for P2.
