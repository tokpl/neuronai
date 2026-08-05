# Product architecture review (Etap 43)

**Positioning:** Neuron is not “AI that does everything.”  
It is **AI that understands your project** — local engineering memory for Cursor.

This review **reduces scope**. It does not add features.

---

## Module priority matrix

| Module / area | Package(s) | Priority | Role in product |
|---------------|------------|----------|-----------------|
| Core types / config | `types`, `config` | **P0** | Foundation |
| Memory storage | `memory-engine`, `ai-memory`, `storage` | **P0** | Persist decisions & knowledge |
| Project scan / code understanding | `project-scanner`, `project-analyzer` | **P0** | First brain bootstrap |
| Knowledge graph | `knowledge-graph` | **P0** | Structure + relations |
| Retrieval | `retrieval-engine`, `embeddings` | **P0** | Right context, budgeted |
| Cursor MCP | `cursor-integration`, `apps/mcp-server`, `apps/cli` | **P0** | Daily surface |
| Basic reasoning | `agent-intelligence`, `decision-engine` (thin) | **P0** | Prepare / recommend / explain |
| Basic privacy | `security` (redaction, consent, local-only) | **P0** | Trust default |
| Core framework | `core-framework` | **P1** | Lifecycle wiring (stabilize after MVP UX) |
| AI runtime | `ai-runtime`, `ai-provider` | **P1** | Local/offline model routing when needed |
| Architecture intelligence | `architect-mode`, `architecture-review`, `project-intelligence` | **P1** | High value after brain exists |
| Documentation | `documentation-intelligence` | **P1** | Living docs from brain |
| Git history | `workflow-intelligence` git/, KG evolution linker | **P1** | “Why is this code like this?” |
| Workflow resume | `workflow-intelligence`, `agent-workflow` | **P1** | Session / handoff continuity |
| Security scanning | `security-core`, `security-intelligence` | **P1** | Self-protection + advisor |
| Observability / debug traces | `observability` | **P1** | “Why did Neuron suggest this?” |
| Assistant modes | `assistant-modes` | **P1** | Cursor workflows (thin orchestration) |
| Memory governance | `memory-governance`, `project-constitution` | **P2** | Quality of memory over time |
| Team brain | `team-brain`, `team-memory` | **P2** | Small-team local sharing |
| Performance intelligence | `performance-intelligence` | **P2** | Advanced advisory |
| Evaluation / benchmarks | `evaluation-engine`, `benchmark` | **P2** | Quality loops, CI |
| Debug intelligence (incidents) | `debug-intelligence` | **P2** | Incident memory |
| Workspace / org foundation | `workspace-core` | **P3** | Multi-project / enterprise prep |
| Enterprise deployment | workspace deployment modes, Postgres polish | **P3** | Self-host enterprise |
| Cloud sync / SaaS | — (stubs only) | **P3 / delay** | Not in public MVP |
| Ops / SDK | `ops`, `sdk` | **P1–P2** | Backup/maintain; SDK after API freeze |

---

## MVP P0 — first public version

**Name:** Neuron v0.1 “Local Project Brain”  
**Promise:** In &lt;10 minutes, Cursor answers with *your* project’s decisions and structure — not a generic LLM guess.

### Must ship

| Capability | Done means |
|------------|------------|
| Project scanner | `neuron init` + `neuron scan` → `.neuron/` brain |
| Memory storage | Local store; save/search decisions |
| Knowledge graph | Modules/relations from scan usable in context |
| Code understanding | Stack + structure signals in brain |
| Retrieval engine | Budgeted context (`neuron_get_context` / prepare) |
| Cursor MCP | `neuron init cursor` / `cursor setup` works |
| Basic reasoning | Prepare task / save decision / search memory |
| Basic privacy | Telemetry OFF; local-only default; secret redaction |

### Explicit non-goals for MVP

- Autonomous agents / multi-agent orchestration  
- Auto-refactor / mass code rewrite  
- Cloud sync, billing, marketplace  
- Full enterprise IAM  
- “Replace GitHub / IDE / APM”

---

## P1 — value right after MVP

Increases daily usefulness once the brain exists:

- Architecture intelligence (review, impact, health score)  
- Documentation generation into `.neuron/docs/`  
- Git history intelligence (why code is like this)  
- Workflow resume / handoff  
- Security check before AI (sanitize / scan)  
- Observability (`explain-last`)  
- Assistant mode commands (`/architect`, `/review`, …) as thin MCP workflows  
- AI runtime offline/local routing  

---

## P2 — advanced users

- Team Brain (local shared knowledge, onboarding)  
- Performance intelligence  
- Evaluation engine + benchmarks  
- Memory governance / constitution maturity  
- Debug incident memory  
- Deeper agent-workflow suggestion loops  

---

## P3 — enterprise / future

- Workspace multi-project / org policies (foundation already exists — keep **experimental**)  
- Advanced permissions / OIDC  
- Enterprise self-host deployment playbooks  
- Optional cloud sync (**consent + premium candidate**)  
- Cross-repo federation  

---

## Remove or delay

| Item | Reason | Risk if kept in MVP messaging | Alternative |
|------|--------|-------------------------------|-------------|
| Cloud sync / SaaS accounts | Breaks local-first story; needs product/ops | Trust + scope explosion | Delay to P3; keep stubs |
| Workspace-core as “ready” | Architecture only; incomplete UX | False enterprise promise | Mark **experimental**; document as foundation |
| Evaluation as default path | Needs datasets + discipline | Noise for new users | P2; optional `neuron benchmark` |
| Performance intelligence in splash | Heuristic advisor, easy to oversell | “APM competitor” confusion | P2; docs say advisor only |
| Team Brain in install default | Needs shared norms + permissions | Half-baked collaboration | P2; optional after solo loop works |
| Assistant multi-mode marketing | Many modes look like “does everything” | Dilutes positioning | Ship P0 tools first; modes as P1 shortcuts |
| Full security-intelligence threat modeling | Valuable but heavy | Competes with SecOps tools | P1: `security-core` sanitize; P1/P2 deeper reviews |
| Automatic maintenance apply | Destructive if opaque | Data loss fear | Keep dry-run default; apply as advanced |
| Plugin marketplace | Explicitly out of product DNA | Support + supply-chain risk | Never in core |

---

## Core user journey (first 10 minutes)

```text
Install (Node 22+, pnpm / published CLI)
  ↓
neuron init
  ↓
neuron scan   (brain creation: architecture, memories, graph seeds)
  ↓
neuron init cursor  (MCP + rules + commands)
  ↓
Reload Cursor MCP
  ↓
Ask: “What are the architecture decisions for payments?”
  ↓
First useful answer (from project brain, not inventing)
```

**Success criterion:** User gets at least one answer that cites *their* decision or module — not generic advice.

---

## Daily loop

```text
Open project in Cursor
  ↓
Ask / start task (or /neuron-context)
  ↓
Neuron MCP: budgeted context + decisions + graph
  ↓
Developer codes with fewer rediscoveries
  ↓
Optionally: neuron_save_decision / suggest from changes
  ↓
Saved time compounds next session
```

**Why every day:** Cursor forgets; Neuron does not forget *this* repo’s judgment.

---

## MVP architecture — package status for v1 public

### In v1 (supported)

`types`, `config`, `security`, `storage`, `memory-engine`, `ai-memory`, `embeddings`, `project-analyzer`, `project-scanner`, `knowledge-graph`, `retrieval-engine`, `agent-intelligence`, `cursor-integration`, `apps/cli`, `apps/mcp-server`, `ops` (backup basics), `ai-provider` (mock/offline path)

### Experimental (present, not promised stable)

`workspace-core`, `core-framework` (full module bus), `assistant-modes`, `architecture-review`, `security-core`, `observability` product traces, `ai-runtime` multi-provider, `decision-engine` full suite, `workflow-intelligence` git depth, `documentation-intelligence`, `architect-mode`

### Disabled / off by default

- Telemetry / cloud uploads  
- Memory governance auto-cleanup apply  
- Enterprise auth modes  

### Future

- Cloud sync, premium team hosting, marketplace, EDR-like security, SaaS billing  

---

## Public release checklist

- [ ] **Documentation:** getting-started, CLI, MCP tools list, privacy model, “what Neuron is / isn’t”  
- [ ] **Examples:** `examples/neuron-demo` or sample `.neuron/` brain  
- [ ] **Installation:** verified &lt;10 min on clean machine (Windows + macOS)  
- [ ] **Security review:** redaction defaults, no secret persistence in traces/git ingest, MCP tool auth notes  
- [ ] **Performance test:** retrieval budget + scan on mid-size repo; document expected times  
- [ ] **Demo project:** scripted Cursor conversation showing decision recall  
- [ ] **Roadmap honesty:** P0 vs experimental labeled in README  
- [ ] **License:** Apache-2.0 LICENSE + CONTRIBUTING  
- [ ] **Version:** semver tag for `neuron/v1` MCP surface freeze subset  

---

## Open source strategy

| Layer | Strategy |
|-------|----------|
| **Core (OSS forever)** | Memory engine, local storage, scanner, graph, retrieval, Cursor MCP, CLI, privacy defaults |
| **OSS advanced** | Architecture/docs/git/workflow advisors — keep open; community improves analyzers |
| **Possible premium later** | Hosted sync, managed team brain, enterprise SSO/support SLAs, hosted evaluation dashboards |
| **Never lock without reason** | Do not closed-source the project brain or MCP protocol that makes Neuron useful offline |

Principle: **premium = ops & hosting convenience**, not “remembering your code.”

---

## Success metrics (MVP)

| Metric | Definition | Early target |
|--------|------------|--------------|
| **Activation** | Completes init → scan → Cursor connect → one useful MCP answer | ≥70% of installs that finish init |
| **Daily usage** | ≥1 MCP context/prepare/search call on active days | Habit within week 1 |
| **Retention** | Returns week 2 with same project brain | Brain file still present + tool call |
| **Response quality** | User marks / feedback that answer used real project memory | Qualitative + optional evaluation later |

Proxy until telemetry (default OFF): GitHub stars ≠ success; **demo completion + issue “it remembered X”** reports do.

---

## Product rule going forward

Every new stage must answer:

1. Does this help Neuron *understand the project*?  
2. Is it P0–P1 for the daily Cursor loop?  
3. If not — mark experimental or delay.

If it makes Neuron look like a general AI platform, **cut it**.
