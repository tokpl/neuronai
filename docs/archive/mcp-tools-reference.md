# MCP tools reference

All tools return JSON text payloads shaped as `{ ok: true, ... }` or `{ ok: false, error: { code, message, details? } }`.

## neuron_get_context

**Input**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `task` | string | yes | What the agent is about to do |
| `projectId` | string | no | Defaults to resolved workspace project |
| `files` | string[] | no | Optional file hints |

**Output:** decisions, relatedMemories, architectureNotes, knownIssues, warnings.

## neuron_search_memory

| Field | Type | Required |
|-------|------|----------|
| `query` | string | yes |
| `projectId` | string | no |
| `limit` | number | no (default 10) |

**Output:** memories with `score`, `confidence`, relation placeholders.

## neuron_save_decision

| Field | Required |
|-------|----------|
| `title`, `problem`, `decision`, `reason` | yes |
| `alternatives` | no |
| `projectId` | no |

Creates `architecture_decision` memory and indexes it for search.

## neuron_store_memory

| Field | Required |
|-------|----------|
| `type` | yes (`knowledge` \| `pattern` \| `mistake` \| `business_rule` \| `dependency` \| `context`) |
| `title`, `content` | yes |
| `tags` | no |

Runs intelligence pipeline then persists.

## neuron_review_memory

| Field | Required |
|-------|----------|
| `text` | yes |

**Output:** `shouldSave`, `reason`, `suggestedType`, `importance`, `action`.

## neuron_update_memory

| Field | Required |
|-------|----------|
| `id`, `reason` | yes |
| `title`, `content` | no |

Appends a new version; does not delete history.

## neuron_project_summary

Returns stack, manifests, decisions, patterns, mistakes for the workspace project.

## neuron_health

Liveness / version / mode / privacyMode.

## Workflow tools (automatic capture)

### neuron_start_task

| Field | Required |
|-------|----------|
| `task` | yes |
| `files` | no |

Starts workflow session, runs before-task hooks, returns context.

### neuron_ingest_event

| Field | Required |
|-------|----------|
| `type` | yes (ProjectOpened, CodeChanged, GitCommitted, …) |
| `payload` | no |

### neuron_after_task

| Field | Required |
|-------|----------|
| `task` / `summary` / `diff` / `files` / `commitMessage` | at least one signal |

Returns analysis + optional suggestion + Save/Edit/Ignore prompt.

### neuron_suggest_from_changes

Analyze a diff/commit without full lifecycle. Same suggestion shape as `neuron_after_task`.

## Agent intelligence tools

### neuron_prepare_task

| Field | Required |
|-------|----------|
| `task` | yes |
| `mode` | no (`fast` \| `standard` \| `architect` \| `debug`) |

Focused briefing + plan (not a full memory dump).

### neuron_review_architecture

| Field | Required |
|-------|----------|
| `changeDescription` | yes |

Score 0–100, issues, recommendations, risk.

### neuron_analyze_impact

| Field | Required |
|-------|----------|
| `target` | yes |

Blast radius / risk for module, file, or change.

### neuron_generate_plan

| Field | Required |
|-------|----------|
| `featureRequest` | yes |

Implementation steps only (no code).

### neuron_project_question

| Field | Required |
|-------|----------|
| `question` | yes |

Answers from knowledge graph + memories.

### neuron_complete_task

| Field | Required |
|-------|----------|
| `task`, `outcome` | yes (`success` \| `partial` \| `failed`) |

Self-improvement loop — stores what worked / failed.

## Debug intelligence

### neuron_debug_context

| Field | Required |
|-------|----------|
| `query` | yes |
| `errorMessage`, `stackTrace`, `changedFiles` | no |

Related incidents, previous solutions, possible causes, risk factors. Does **not** auto-fix.

### neuron_search_incidents

| Field | Required |
|-------|----------|
| `query` | yes |

### neuron_root_cause

| Field | Required |
|-------|----------|
| `query` | yes |
| `errorMessage`, `stackTrace`, `changedFiles` | no |

Ranked causes with confidence (advisory).

### neuron_create_incident

| Field | Required |
|-------|----------|
| `title`, `description` | yes |
| `severity`, `affectedModules`, `links` | no |

Creates OPEN incident (user-confirmed). Resolve later for lesson memory.

### neuron_incident_history

| Field | Required |
|-------|----------|
| `incidentId` | yes |

See [debug-intelligence.md](./debug-intelligence.md).

## Security intelligence

### neuron_security_context

| Field | Required |
|-------|----------|
| `query` | yes |
| `filePaths` | no |

Relevant security rules, patterns, risks.

### neuron_security_review

| Field | Required |
|-------|----------|
| `mode` | no (`QUICK` \| `DEEP` \| `CHANGE`) |
| `query`, `diff`, `changedPaths`, `files`, `writeReport` | no |

### neuron_threat_model

| Field | Required |
|-------|----------|
| `modules`, `entryPoints`, `assets` | no |

### neuron_security_history

| Field | Required |
|-------|----------|
| `query` | no |

### neuron_check_change_security

| Field | Required |
|-------|----------|
| `diff`, `changedPaths`, `modules` | no |

See [security-intelligence.md](./security-intelligence.md).

## Documentation intelligence

### neuron_generate_docs

Generates living docs into `.neuron/docs/`.

### neuron_docs_health

Documentation health score (accuracy / freshness / coverage / consistency).

### neuron_explain_project / neuron_project_documentation

Current architecture summary for “explain this project”.

### neuron_module_docs

Module documentation (purpose, deps, security, decisions).

### neuron_generate_changelog

Smart changelog from features, decisions, incidents.

See [documentation-intelligence.md](./documentation-intelligence.md).

## Performance intelligence

### neuron_performance_context

Patterns, bottlenecks, risks, prior optimizations for a query/module.

### neuron_performance_review

Full review → `.neuron/performance-report.md`.

### neuron_scalability_check

Coupling / scale warnings.

### neuron_database_review

N+1, indexes, large joins (heuristics).

### neuron_performance_history

Past findings + applied optimizations.

See [performance-intelligence.md](./performance-intelligence.md).

## Workflow intelligence

### neuron_resume / neuron_resume_context

Previous technical work context.

### neuron_session_summary

`work-summary.md` for the session.

### neuron_current_focus

Limit context to the active technical area.

### neuron_handoff

Technical handoff document.

### neuron_task_context

Task memory + architecture-aware breakdown.

See [workflow-intelligence.md](./workflow-intelligence.md).

## Knowledge Graph 2.0

### neuron_graph_query

Impact map / reasoning for questions like “What affects authentication?”.

### neuron_impact_analysis

Blast radius for a change target (alias of `neuron_analyze_impact`).

### neuron_related_knowledge

Graph neighbors: memories, documents, incidents, decisions.

### neuron_project_map / neuron_graph_project_map

Architecture + knowledge graph stats; writes local `graph.json`.

See [knowledge-graph.md](./knowledge-graph.md).

## Decision engine

### neuron_reason

Full reasoning + DecisionTrace.

### neuron_recommend / neuron_decision_context

Recommendation with evidence, risks, alternatives.

### neuron_compare_options

Option A vs B + tradeoffs.

### neuron_explain_decision

Explain a prior decision.

See [decision-engine.md](./decision-engine.md).

## AI runtime

### neuron_ai_status

Mode, local discovery (Ollama / LM Studio), offline capabilities, provider health.

### neuron_select_model / neuron_best_model_for_task

Task-profile routing under privacy constraints.

### neuron_privacy_check

Classify context and whether cloud is allowed.

### neuron_model_health / neuron_available_models

Provider health and catalog filtered by `allowCloud`.

See [ai-runtime.md](./ai-runtime.md), [local-models.md](./local-models.md), [privacy.md](./privacy.md).

## Team Brain

### neuron_team_context

Shared team knowledge + optional conflict detection for a query.

### neuron_team_decisions

Shared architecture decisions + engineering timeline.

### neuron_team_rules

Approved team rules / patterns / security standards.

### neuron_onboarding

New Developer Mode pack (architecture, decisions, mistakes, security).

See [team-brain.md](./team-brain.md), [team-memory.md](./team-memory.md), [onboarding-mode.md](./onboarding-mode.md).

## Evaluation Engine

### neuron_quality_report

Dashboard metrics, feedback, improvements, regressions.

### neuron_evaluate_answer

Score an answer (+ optional hallucination context).

### neuron_memory_quality

Confidence / usage / validation / freshness per memory.

### neuron_benchmark

Run builtin + `.neuron/benchmarks/` suite → `evaluation.json`.

See [evaluation-engine.md](./evaluation-engine.md), [quality-system.md](./quality-system.md), [benchmarks.md](./benchmarks.md).

## Memory Governance

### neuron_memory_health

Lifecycle health report + writes `.neuron/memory-health.md`.

### neuron_memory_conflicts

REST vs GraphQL-style conflicts (approval required).

### neuron_memory_review

Review queue: conflicts, outdated, low confidence.

### neuron_memory_cleanup

Maintenance proposals (merge/archive/invalidate/recalculate) — never permanent delete.

See [memory-lifecycle.md](./memory-lifecycle.md), [memory-quality.md](./memory-quality.md), [conflict-resolution.md](./conflict-resolution.md).

## Agent resources

- `neuron://agent/context`
- `neuron://agent/recommendations`
- `neuron://agent/risks`

See [agent-intelligence.md](./agent-intelligence.md) and [agent-workflow.md](./agent-workflow.md).
