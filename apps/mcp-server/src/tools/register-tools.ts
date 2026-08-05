import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { NeuronRuntime } from '../config/runtime.js';
import {
  handleAfterTask,
  handleAnalyzeImpact,
  handleAcceptConstitutionRule,
  handleArchitectureContext,
  handleCompleteTask,
  handleDeepSearch,
  handleExplainContext,
  handleGenerateCursorRules,
  handleGeneratePlan,
  handleGetContext,
  handleIngestEvent,
  handleOnboarding,
  handleOptimizeContext,
  handlePrepareTask,
  handleProjectHealth,
  handleProjectQuestion,
  handleProjectRules,
  handleProjectSummary,
  handleReviewArchitecture,
  handleReviewEvolution,
  handleReviewMemory,
  handleSaveDecision,
  handleSearchMemory,
  handleStartTask,
  handleStoreMemory,
  handleSuggestFromChanges,
  handleSuggestRule,
  handleTeamContext,
  handleContributors,
  handleDecisionHistory,
  handleTeamDecisions,
  handleTeamRules,
  handleMemoryHealth,
  handleReviewQueue,
  handleCleanupSuggestions,
  handleMemoryConflicts,
  handleMemoryReview,
  handleMemoryCleanup,
  handleBenchmarkStatus,
  handleScanProject,
  handleProjectMap,
  handleRefreshBrain,
  handleProjectChanges,
  handleDetectDrift,
  handlePendingMemories,
  handleProjectHealthLive,
  handleArchitect,
  handleCreatePlan,
  handleReviewChange,
  handleCompareArchitecture,
  handleGenerateAdr,
  handleDebugContext,
  handleSearchIncidents,
  handleRootCause,
  handleCreateIncident,
  handleIncidentHistory,
  handleSecurityContext,
  handleSecurityReview,
  handleThreatModel,
  handleSecurityHistory,
  handleCheckChangeSecurity,
  handleGenerateDocs,
  handleDocsHealth,
  handleExplainProject,
  handleModuleDocs,
  handleGenerateChangelog,
  handleProjectDocumentation,
  handlePerformanceContext,
  handlePerformanceReview,
  handleScalabilityCheck,
  handleDatabaseReview,
  handlePerformanceHistory,
  handleResume,
  handleResumeContext,
  handleSessionSummary,
  handleCurrentFocus,
  handleHandoff,
  handleTaskContext,
  handleGraphQuery,
  handleImpactAnalysis,
  handleRelatedKnowledge,
  handleGraphProjectMap,
  handleReason,
  handleRecommend,
  handleDecisionContext,
  handleCompareOptions,
  handleExplainDecision,
  handleAiStatus,
  handleSelectModel,
  handlePrivacyCheck,
  handleModelHealth,
  handleAvailableModels,
  handleBestModelForTask,
  handleQualityReport,
  handleEvaluateAnswer,
  handleMemoryQuality,
  handleBenchmarkRun,
  handleTraceLast,
  handleExplainReasoning,
  handleTraceContext,
  handlePerformanceMetrics,
  handleObservabilityDebug,
  handleSecurityScan,
  handleCheckContext,
  handleTrustReport,
  handleAuditLog,
  handleNeuronSecurityCheck,
  handleWorkspaceInfo,
  handleProjectSwitch,
  handleAccessCheck,
  handleStorageStatus,
  handleArchitectureScan,
  handleDependencyGraph,
  handleRefactorPlan,
  handleArchitectureScore,
  handleArchitectureReview,
  handleAvailableModes,
  handleModeContext,
  handleRunMode,
  handleGitContext,
  handleChangeHistory,
  handleArchitectureEvolution,
  handleRegressionCheck,
  handleHistoryContext,
  handleUpdateMemory,
} from '../handlers/index.js';
import { getHealth, VERSION } from '../health.js';
import {
  afterTaskSchema,
  analyzeImpactSchema,
  completeTaskSchema,
  generatePlanSchema,
  getContextSchema,
  ingestEventSchema,
  prepareTaskSchema,
  projectQuestionSchema,
  projectSummarySchema,
  acceptConstitutionRuleSchema,
  architectureContextSchema,
  reviewArchitectureSchema,
  reviewEvolutionSchema,
  reviewMemorySchema,
  saveDecisionSchema,
  searchMemorySchema,
  startTaskSchema,
  storeMemorySchema,
  suggestChangesSchema,
  suggestRuleSchema,
  deepSearchSchema,
  optimizeContextSchema,
  explainContextSchema,
  teamContextSchema,
  onboardingSchema,
  decisionHistorySchema,
  teamDecisionsSchema,
  teamRulesSchema,
  contributorsSchema,
  reviewQueueSchema,
  cleanupSuggestionsSchema,
  memoryConflictsSchema,
  memoryReviewSchema,
  memoryCleanupSchema,
  scanProjectSchema,
  projectChangesSchema,
  pendingMemoriesSchema,
  architectSchema,
  createPlanSchema,
  reviewChangeSchema,
  compareArchitectureSchema,
  generateAdrSchema,
  debugContextSchema,
  searchIncidentsSchema,
  rootCauseSchema,
  createIncidentSchema,
  incidentHistorySchema,
  securityContextSchema,
  securityReviewSchema,
  threatModelSchema,
  securityHistorySchema,
  checkChangeSecuritySchema,
  generateDocsSchema,
  docsHealthSchema,
  explainProjectSchema,
  moduleDocsSchema,
  generateChangelogSchema,
  projectDocumentationSchema,
  performanceContextSchema,
  performanceReviewSchema,
  scalabilityCheckSchema,
  databaseReviewSchema,
  performanceHistorySchema,
  resumeSchema,
  sessionSummarySchema,
  currentFocusSchema,
  handoffSchema,
  taskContextSchema,
  graphQuerySchema,
  impactAnalysisSchema,
  relatedKnowledgeSchema,
  graphProjectMapSchema,
  reasonSchema,
  recommendSchema,
  decisionContextSchema,
  compareOptionsSchema,
  explainDecisionSchema,
  aiStatusSchema,
  selectModelSchema,
  privacyCheckSchema,
  modelHealthSchema,
  availableModelsSchema,
  bestModelForTaskSchema,
  qualityReportSchema,
  evaluateAnswerSchema,
  memoryQualitySchema,
  benchmarkRunSchema,
  traceLastSchema,
  explainReasoningSchema,
  traceContextSchema,
  performanceMetricsSchema,
  observabilityDebugSchema,
  securityScanCoreSchema,
  checkContextSchema,
  trustReportSchema,
  auditLogSchema,
  neuronSecurityCheckSchema,
  workspaceInfoSchema,
  projectSwitchSchema,
  accessCheckSchema,
  storageStatusSchema,
  architectureScanSchema,
  dependencyGraphSchema,
  refactorPlanSchema,
  architectureScoreSchema,
  architectureReviewToolSchema,
  availableModesSchema,
  modeContextSchema,
  runModeSchema,
  gitContextSchema,
  changeHistorySchema,
  architectureEvolutionSchema,
  regressionCheckSchema,
  historyContextSchema,
  updateMemorySchema,
} from '../validation/schemas.js';

export function registerTools(server: McpServer, runtime: NeuronRuntime): void {
  server.registerTool(
    'neuron_health',
    {
      description: 'Return Neuron AI Memory MCP server health and version.',
      inputSchema: {},
    },
    async () => {
      const health = getHealth(runtime.config.server.mode);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { ...health, version: VERSION, privacyMode: runtime.privacyMode },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'neuron_get_context',
    {
      description:
        'Fetch the most relevant project knowledge before starting a coding task (decisions, warnings, related memories).',
      inputSchema: getContextSchema,
    },
    async (args) => handleGetContext(runtime, args),
  );

  server.registerTool(
    'neuron_start_task',
    {
      description:
        'Begin an agent coding task: publish AgentStartedTask, run before hooks, return Neuron context.',
      inputSchema: startTaskSchema,
    },
    async (args) => handleStartTask(runtime, args),
  );

  server.registerTool(
    'neuron_ingest_event',
    {
      description: 'Ingest a development event (CodeChanged, GitCommitted, …) into the workflow bus.',
      inputSchema: ingestEventSchema,
    },
    async (args) => handleIngestEvent(runtime, args),
  );

  server.registerTool(
    'neuron_after_task',
    {
      description:
        'After coding: analyze changes, run MemorySuggestionEngine, return Save/Edit/Ignore prompt (respects privacy mode).',
      inputSchema: afterTaskSchema,
    },
    async (args) => handleAfterTask(runtime, args),
  );

  server.registerTool(
    'neuron_suggest_from_changes',
    {
      description:
        'Analyze a diff/files/commit message and return a memory suggestion without full task lifecycle.',
      inputSchema: suggestChangesSchema,
    },
    async (args) => handleSuggestFromChanges(runtime, args),
  );

  server.registerTool(
    'neuron_search_memory',
    {
      description: 'Semantic/hybrid search over project engineering memories.',
      inputSchema: searchMemorySchema,
    },
    async (args) => handleSearchMemory(runtime, args),
  );

  server.registerTool(
    'neuron_save_decision',
    {
      description:
        'Persist an architecture decision (problem, decision, reason, alternatives) with validation and versioning.',
      inputSchema: saveDecisionSchema,
    },
    async (args) => handleSaveDecision(runtime, args),
  );

  server.registerTool(
    'neuron_store_memory',
    {
      description: 'Store knowledge, patterns, mistakes, or other typed project memories.',
      inputSchema: storeMemorySchema,
    },
    async (args) => handleStoreMemory(runtime, args),
  );

  server.registerTool(
    'neuron_review_memory',
    {
      description:
        'Ask Neuron whether a piece of information is worth remembering (shouldSave, type, importance).',
      inputSchema: reviewMemorySchema,
    },
    async (args) => handleReviewMemory(runtime, args),
  );

  server.registerTool(
    'neuron_update_memory',
    {
      description: 'Update an existing memory and append a new version (history is preserved).',
      inputSchema: updateMemorySchema,
    },
    async (args) => handleUpdateMemory(runtime, args),
  );

  server.registerTool(
    'neuron_project_summary',
    {
      description: 'Summarize project stack, architecture decisions, modules, and known issues.',
      inputSchema: projectSummarySchema,
    },
    async (args) => handleProjectSummary(runtime, args),
  );

  server.registerTool(
    'neuron_prepare_task',
    {
      description:
        'Senior-dev prep before coding: focused architecture, decisions, warnings, plan (not a full memory dump).',
      inputSchema: prepareTaskSchema,
    },
    async (args) => handlePrepareTask(runtime, args),
  );

  server.registerTool(
    'neuron_review_architecture',
    {
      description: 'Review a proposed change against graph, decisions, patterns; returns score 0–100.',
      inputSchema: reviewArchitectureSchema,
    },
    async (args) => handleReviewArchitecture(runtime, args),
  );

  server.registerTool(
    'neuron_analyze_impact',
    {
      description: 'Analyze blast radius / risk for a file, module, or change target.',
      inputSchema: analyzeImpactSchema,
    },
    async (args) => handleAnalyzeImpact(runtime, args),
  );

  server.registerTool(
    'neuron_impact_analysis',
    {
      description: 'Graph 2.0 alias: blast radius / impact score for changing a target.',
      inputSchema: impactAnalysisSchema,
    },
    async (args) => handleImpactAnalysis(runtime, args),
  );

  server.registerTool(
    'neuron_graph_query',
    {
      description: 'Graph reasoning / impact map (e.g. "What affects authentication?").',
      inputSchema: graphQuerySchema,
    },
    async (args) => handleGraphQuery(runtime, args),
  );

  server.registerTool(
    'neuron_related_knowledge',
    {
      description: 'Related memories, documents, incidents, decisions via graph traversal.',
      inputSchema: relatedKnowledgeSchema,
    },
    async (args) => handleRelatedKnowledge(runtime, args),
  );

  server.registerTool(
    'neuron_graph_project_map',
    {
      description: 'Export knowledge graph map + write local graph.json for visualization.',
      inputSchema: graphProjectMapSchema,
    },
    async (args) => handleGraphProjectMap(runtime, args),
  );

  server.registerTool(
    'neuron_generate_plan',
    {
      description: 'Generate an implementation plan (steps/modules) without writing code.',
      inputSchema: generatePlanSchema,
    },
    async (args) => handleGeneratePlan(runtime, args),
  );

  server.registerTool(
    'neuron_project_question',
    {
      description: 'Ask an architecture question answered from knowledge graph + memories.',
      inputSchema: projectQuestionSchema,
    },
    async (args) => handleProjectQuestion(runtime, args),
  );

  server.registerTool(
    'neuron_complete_task',
    {
      description:
        'Self-improvement loop after a task: store what worked / failed patterns into memory.',
      inputSchema: completeTaskSchema,
    },
    async (args) => handleCompleteTask(runtime, args),
  );

  server.registerTool(
    'neuron_project_rules',
    {
      description: 'Show the Project Constitution (active + suggested rules).',
      inputSchema: {},
    },
    async (args) => handleProjectRules(runtime, args),
  );

  server.registerTool(
    'neuron_suggest_rule',
    {
      description:
        'Propose new constitution rules from memories/patterns (suggestions only — no auto CRITICAL).',
      inputSchema: suggestRuleSchema,
    },
    async (args) => handleSuggestRule(runtime, args),
  );

  server.registerTool(
    'neuron_project_health',
    {
      description: 'Score project health (architecture, docs, memory, compliance, tech debt).',
      inputSchema: {},
    },
    async (args) => handleProjectHealth(runtime, args),
  );

  server.registerTool(
    'neuron_review_evolution',
    {
      description: 'Periodic self-learning review: outdated rules, new patterns, conflicts.',
      inputSchema: reviewEvolutionSchema,
    },
    async (args) => handleReviewEvolution(runtime, args),
  );

  server.registerTool(
    'neuron_generate_cursor_rules',
    {
      description: 'Write .cursor/rules/project-architecture.mdc from active constitution rules.',
      inputSchema: {},
    },
    async (args) => handleGenerateCursorRules(runtime, args),
  );

  server.registerTool(
    'neuron_accept_constitution_rule',
    {
      description:
        'Human approval: promote a suggested rule to active (set asCritical for CRITICAL — becomes manual).',
      inputSchema: acceptConstitutionRuleSchema,
    },
    async (args) => handleAcceptConstitutionRule(runtime, args),
  );

  server.registerTool(
    'neuron_deep_search',
    {
      description:
        'Advanced multi-source retrieval (memory, decisions, constitution, code, graph) with ranking.',
      inputSchema: deepSearchSchema,
    },
    async (args) => handleDeepSearch(runtime, args),
  );

  server.registerTool(
    'neuron_optimize_context',
    {
      description: 'Preview the optimized agent context (token budget, compression) for a task.',
      inputSchema: optimizeContextSchema,
    },
    async (args) => handleOptimizeContext(runtime, args),
  );

  server.registerTool(
    'neuron_explain_context',
    {
      description: 'Explain why specific memories/rules were selected for a task.',
      inputSchema: explainContextSchema,
    },
    async (args) => handleExplainContext(runtime, args),
  );

  server.registerTool(
    'neuron_architecture_context',
    {
      description: 'Assemble architecture-oriented context (larger budget / architect mode).',
      inputSchema: architectureContextSchema,
    },
    async (args) => handleArchitectureContext(runtime, args),
  );

  server.registerTool(
    'neuron_team_context',
    {
      description:
        'Shared team/project knowledge for a query (local scopes — PERSONAL/PROJECT/TEAM). No cloud.',
      inputSchema: teamContextSchema,
    },
    async (args) => handleTeamContext(runtime, args),
  );

  server.registerTool(
    'neuron_onboarding',
    {
      description:
        'Generate an onboarding pack: architecture, decisions, mistakes, coding rules for new developers.',
      inputSchema: onboardingSchema,
    },
    async (args) => handleOnboarding(runtime, args),
  );

  server.registerTool(
    'neuron_decision_history',
    {
      description: 'Timeline of team decisions (proposed → reviewed → active). Alias of neuron_team_decisions.',
      inputSchema: decisionHistorySchema,
    },
    async (args) => handleDecisionHistory(runtime, args),
  );

  server.registerTool(
    'neuron_team_decisions',
    {
      description: 'Team shared architecture decisions + engineering timeline (local Team Brain).',
      inputSchema: teamDecisionsSchema,
    },
    async (args) => handleTeamDecisions(runtime, args),
  );

  server.registerTool(
    'neuron_team_rules',
    {
      description: 'Approved team rules, patterns, and security standards from the Team Brain.',
      inputSchema: teamRulesSchema,
    },
    async (args) => handleTeamRules(runtime, args),
  );

  server.registerTool(
    'neuron_contributors',
    {
      description: 'Who created / approved team knowledge (local contribution ledger).',
      inputSchema: contributorsSchema,
    },
    async (args) => handleContributors(runtime, args),
  );

  server.registerTool(
    'neuron_memory_health',
    {
      description:
        'Project memory health report (stale/conflicts/duplicates scores). Proposes only — no auto-delete.',
      inputSchema: {},
    },
    async (args) => handleMemoryHealth(runtime, args),
  );

  server.registerTool(
    'neuron_review_queue',
    {
      description: 'Memories that need human review (stale, conflicts, policy due dates).',
      inputSchema: reviewQueueSchema,
    },
    async (args) => handleReviewQueue(runtime, args),
  );

  server.registerTool(
    'neuron_cleanup_suggestions',
    {
      description:
        'Suggested merge / supersede / review actions. All requireApproval — Neuron never auto-archives.',
      inputSchema: cleanupSuggestionsSchema,
    },
    async (args) => handleCleanupSuggestions(runtime, args),
  );

  server.registerTool(
    'neuron_memory_conflicts',
    {
      description: 'Detect conflicting memories (e.g. REST vs GraphQL). Requires human resolution.',
      inputSchema: memoryConflictsSchema,
    },
    async (args) => handleMemoryConflicts(runtime, args),
  );

  server.registerTool(
    'neuron_memory_review',
    {
      description: 'Review queue: conflicts, low confidence, outdated, important changes.',
      inputSchema: memoryReviewSchema,
    },
    async (args) => handleMemoryReview(runtime, args),
  );

  server.registerTool(
    'neuron_memory_cleanup',
    {
      description:
        'Run maintenance proposals (merge/archive/invalidate/recalculate). Never permanent delete. Approval required.',
      inputSchema: memoryCleanupSchema,
    },
    async (args) => handleMemoryCleanup(runtime, args),
  );

  server.registerTool(
    'neuron_benchmark_status',
    {
      description:
        'Benchmark / evaluation status (memory-layer metrics readiness). Does not train models.',
      inputSchema: {},
    },
    async (args) => handleBenchmarkStatus(runtime, args),
  );

  server.registerTool(
    'neuron_scan_project',
    {
      description:
        'Bootstrap or refresh Project Brain (stack, architecture, memories, suggested constitution).',
      inputSchema: scanProjectSchema,
    },
    async (args) => handleScanProject(runtime, args),
  );

  server.registerTool(
    'neuron_project_map',
    {
      description: 'Return architecture map + dependency graph from the latest scan / .neuron brain.',
      inputSchema: {},
    },
    async (args) => handleProjectMap(runtime, args),
  );

  server.registerTool(
    'neuron_refresh_brain',
    {
      description: 'Incremental Project Brain update (git/mtime cache aware).',
      inputSchema: {},
    },
    async (args) => handleRefreshBrain(runtime, args),
  );

  server.registerTool(
    'neuron_project_changes',
    {
      description: 'Recent important project changes (files / commits) from continuous intelligence.',
      inputSchema: projectChangesSchema,
    },
    async (args) => handleProjectChanges(runtime, args),
  );

  server.registerTool(
    'neuron_detect_drift',
    {
      description: 'Detect architecture drift vs declared conventions (suggest only).',
      inputSchema: {},
    },
    async (args) => handleDetectDrift(runtime, args),
  );

  server.registerTool(
    'neuron_pending_memories',
    {
      description: 'Suggested memories / Cursor rules waiting for developer approval.',
      inputSchema: pendingMemoriesSchema,
    },
    async (args) => handlePendingMemories(runtime, args),
  );

  server.registerTool(
    'neuron_project_health_live',
    {
      description: 'Live project health from continuous intelligence (drift + pending + high changes).',
      inputSchema: {},
    },
    async (args) => handleProjectHealthLive(runtime, args),
  );

  server.registerTool(
    'neuron_architect',
    {
      description:
        'Architect Mode: full architecture analysis + plan + risks + pending ADR (no code generation).',
      inputSchema: architectSchema,
    },
    async (args) => handleArchitect(runtime, args),
  );

  server.registerTool(
    'neuron_create_plan',
    {
      description: 'Implementation plan outline only (DB → services → API → UI → tests → docs).',
      inputSchema: createPlanSchema,
    },
    async (args) => handleCreatePlan(runtime, args),
  );

  server.registerTool(
    'neuron_review_change',
    {
      description: 'Review implementation vs architecture plan (compliance, patterns, tests).',
      inputSchema: reviewChangeSchema,
    },
    async (args) => handleReviewChange(runtime, args),
  );

  server.registerTool(
    'neuron_compare_architecture',
    {
      description: 'Compare architecture score before/after a change (0–100).',
      inputSchema: compareArchitectureSchema,
    },
    async (args) => handleCompareArchitecture(runtime, args),
  );

  server.registerTool(
    'neuron_generate_adr',
    {
      description: 'Generate an Architecture Decision Record (Pending approval — human must accept).',
      inputSchema: generateAdrSchema,
    },
    async (args) => handleGenerateAdr(runtime, args),
  );

  server.registerTool(
    'neuron_debug_context',
    {
      description:
        'Debug assist: related incidents, previous solutions, possible root causes, risk factors (no auto-fix).',
      inputSchema: debugContextSchema,
    },
    async (args) => handleDebugContext(runtime, args),
  );

  server.registerTool(
    'neuron_search_incidents',
    {
      description: 'Search similar past incidents and resolutions.',
      inputSchema: searchIncidentsSchema,
    },
    async (args) => handleSearchIncidents(runtime, args),
  );

  server.registerTool(
    'neuron_root_cause',
    {
      description: 'Rank possible root causes with confidence (advisory only).',
      inputSchema: rootCauseSchema,
    },
    async (args) => handleRootCause(runtime, args),
  );

  server.registerTool(
    'neuron_create_incident',
    {
      description: 'Create an OPEN incident (user-confirmed). Resolve later to store lessons.',
      inputSchema: createIncidentSchema,
    },
    async (args) => handleCreateIncident(runtime, args),
  );

  server.registerTool(
    'neuron_incident_history',
    {
      description: 'Timeline + memory for a specific incident id.',
      inputSchema: incidentHistorySchema,
    },
    async (args) => handleIncidentHistory(runtime, args),
  );

  server.registerTool(
    'neuron_security_context',
    {
      description:
        'Security advisor context: rules, patterns, risks for a feature request (no auto-fix).',
      inputSchema: securityContextSchema,
    },
    async (args) => handleSecurityContext(runtime, args),
  );

  server.registerTool(
    'neuron_security_review',
    {
      description: 'Security review (QUICK | DEEP | CHANGE). Writes security-report.md by default.',
      inputSchema: securityReviewSchema,
    },
    async (args) => handleSecurityReview(runtime, args),
  );

  server.registerTool(
    'neuron_threat_model',
    {
      description: 'Generate a lightweight threat model (assets, entry points, risks).',
      inputSchema: threatModelSchema,
    },
    async (args) => handleThreatModel(runtime, args),
  );

  server.registerTool(
    'neuron_security_history',
    {
      description: 'History of security findings / security memories (no secret values).',
      inputSchema: securityHistorySchema,
    },
    async (args) => handleSecurityHistory(runtime, args),
  );

  server.registerTool(
    'neuron_check_change_security',
    {
      description: 'Analyze git diff / changed paths for security impact (LOW→HIGH).',
      inputSchema: checkChangeSecuritySchema,
    },
    async (args) => handleCheckChangeSecurity(runtime, args),
  );

  server.registerTool(
    'neuron_generate_docs',
    {
      description:
        'Generate living docs (architecture, modules, onboarding…) into .neuron/docs/ (no wiki SaaS).',
      inputSchema: generateDocsSchema,
    },
    async (args) => handleGenerateDocs(runtime, args),
  );

  server.registerTool(
    'neuron_docs_health',
    {
      description: 'Documentation health score (accuracy, freshness, coverage, consistency).',
      inputSchema: docsHealthSchema,
    },
    async (args) => handleDocsHealth(runtime, args),
  );

  server.registerTool(
    'neuron_explain_project',
    {
      description: 'Explain the project with a current architecture summary.',
      inputSchema: explainProjectSchema,
    },
    async (args) => handleExplainProject(runtime, args),
  );

  server.registerTool(
    'neuron_project_documentation',
    {
      description: 'Cursor alias: current architecture / project documentation summary.',
      inputSchema: projectDocumentationSchema,
    },
    async (args) => handleProjectDocumentation(runtime, args),
  );

  server.registerTool(
    'neuron_module_docs',
    {
      description: 'Generate documentation for a specific module.',
      inputSchema: moduleDocsSchema,
    },
    async (args) => handleModuleDocs(runtime, args),
  );

  server.registerTool(
    'neuron_generate_changelog',
    {
      description: 'Smart changelog from features, decisions, incidents (not commits alone).',
      inputSchema: generateChangelogSchema,
    },
    async (args) => handleGenerateChangelog(runtime, args),
  );

  server.registerTool(
    'neuron_performance_context',
    {
      description:
        'Performance advisor context: patterns, bottlenecks, risks, prior optimizations (no APM).',
      inputSchema: performanceContextSchema,
    },
    async (args) => handlePerformanceContext(runtime, args),
  );

  server.registerTool(
    'neuron_performance_review',
    {
      description: 'Full performance review; writes performance-report.md by default.',
      inputSchema: performanceReviewSchema,
    },
    async (args) => handlePerformanceReview(runtime, args),
  );

  server.registerTool(
    'neuron_scalability_check',
    {
      description: 'Architecture scalability / coupling warnings (e.g. prefer events over direct calls).',
      inputSchema: scalabilityCheckSchema,
    },
    async (args) => handleScalabilityCheck(runtime, args),
  );

  server.registerTool(
    'neuron_database_review',
    {
      description: 'Database/ORM performance heuristics (N+1, indexes, large joins).',
      inputSchema: databaseReviewSchema,
    },
    async (args) => handleDatabaseReview(runtime, args),
  );

  server.registerTool(
    'neuron_performance_history',
    {
      description: 'History of performance findings and applied optimizations.',
      inputSchema: performanceHistorySchema,
    },
    async (args) => handlePerformanceHistory(runtime, args),
  );

  server.registerTool(
    'neuron_resume',
    {
      description:
        'Resume technical work context (last summary, files, pending decisions, next steps). No people tracking.',
      inputSchema: resumeSchema,
    },
    async (args) => handleResume(runtime, args),
  );

  server.registerTool(
    'neuron_resume_context',
    {
      description: 'Cursor alias for neuron_resume — previous technical work context.',
      inputSchema: resumeSchema,
    },
    async (args) => handleResumeContext(runtime, args),
  );

  server.registerTool(
    'neuron_session_summary',
    {
      description: 'Generate work-summary.md for the technical session (optional close).',
      inputSchema: sessionSummarySchema,
    },
    async (args) => handleSessionSummary(runtime, args),
  );

  server.registerTool(
    'neuron_current_focus',
    {
      description: 'Get/set focused technical area to avoid flooding Cursor with whole-project context.',
      inputSchema: currentFocusSchema,
    },
    async (args) => handleCurrentFocus(runtime, args),
  );

  server.registerTool(
    'neuron_handoff',
    {
      description: 'Technical handoff doc (state/completed/pending/risks/decisions) for future-you or another developer.',
      inputSchema: handoffSchema,
    },
    async (args) => handleHandoff(runtime, args),
  );

  server.registerTool(
    'neuron_task_context',
    {
      description: 'Technical task memory + architecture-aware breakdown (not Jira).',
      inputSchema: taskContextSchema,
    },
    async (args) => handleTaskContext(runtime, args),
  );

  server.registerTool(
    'neuron_reason',
    {
      description:
        'Evidence-based reasoning for a request (recommendation + explanation + DecisionTrace). Advisory only.',
      inputSchema: reasonSchema,
    },
    async (args) => handleReason(runtime, args),
  );

  server.registerTool(
    'neuron_recommend',
    {
      description: 'Produce a recommendation with evidence, risks, and alternatives.',
      inputSchema: recommendSchema,
    },
    async (args) => handleRecommend(runtime, args),
  );

  server.registerTool(
    'neuron_decision_context',
    {
      description: 'Cursor decision context: recommendation, evidence, risks, alternatives.',
      inputSchema: decisionContextSchema,
    },
    async (args) => handleDecisionContext(runtime, args),
  );

  server.registerTool(
    'neuron_compare_options',
    {
      description: 'Compare Option A vs B with tradeoffs and an explicit recommendation.',
      inputSchema: compareOptionsSchema,
    },
    async (args) => handleCompareOptions(runtime, args),
  );

  server.registerTool(
    'neuron_explain_decision',
    {
      description: 'Explain why a prior NeuronDecision was made (DecisionTrace).',
      inputSchema: explainDecisionSchema,
    },
    async (args) => handleExplainDecision(runtime, args),
  );

  server.registerTool(
    'neuron_ai_status',
    {
      description:
        'AI runtime status: mode, local models (Ollama/LM Studio), offline capabilities, provider health.',
      inputSchema: aiStatusSchema,
    },
    async (args) => handleAiStatus(runtime, args),
  );

  server.registerTool(
    'neuron_select_model',
    {
      description: 'Select the best model for a task profile under privacy constraints.',
      inputSchema: selectModelSchema,
    },
    async (args) => handleSelectModel(runtime, args),
  );

  server.registerTool(
    'neuron_privacy_check',
    {
      description:
        'Classify data (PUBLIC/INTERNAL/SENSITIVE/CRITICAL) and whether cloud is allowed.',
      inputSchema: privacyCheckSchema,
    },
    async (args) => handlePrivacyCheck(runtime, args),
  );

  server.registerTool(
    'neuron_model_health',
    {
      description: 'Health check for configured AI providers.',
      inputSchema: modelHealthSchema,
    },
    async (args) => handleModelHealth(runtime, args),
  );

  server.registerTool(
    'neuron_available_models',
    {
      description: 'List models available under current privacy / allowCloud policy.',
      inputSchema: availableModelsSchema,
    },
    async (args) => handleAvailableModels(runtime, args),
  );

  server.registerTool(
    'neuron_best_model_for_task',
    {
      description: 'Alias of neuron_select_model — recommend model for a task.',
      inputSchema: bestModelForTaskSchema,
    },
    async (args) => handleBestModelForTask(runtime, args),
  );

  server.registerTool(
    'neuron_quality_report',
    {
      description:
        'Quality intelligence report: scores, feedback, improvements, regressions (metrics only).',
      inputSchema: qualityReportSchema,
    },
    async (args) => handleQualityReport(runtime, args),
  );

  server.registerTool(
    'neuron_evaluate_answer',
    {
      description:
        'Evaluate whether an answer was good (accuracy/relevance/…) with optional hallucination checks.',
      inputSchema: evaluateAnswerSchema,
    },
    async (args) => handleEvaluateAnswer(runtime, args),
  );

  server.registerTool(
    'neuron_memory_quality',
    {
      description: 'Score memories by confidence, usage, validation, freshness.',
      inputSchema: memoryQualitySchema,
    },
    async (args) => handleMemoryQuality(runtime, args),
  );

  server.registerTool(
    'neuron_benchmark',
    {
      description:
        'Run Neuron quality benchmark suite (builtin + .neuron/benchmarks/). No model training.',
      inputSchema: benchmarkRunSchema,
    },
    async (args) => handleBenchmarkRun(runtime, args),
  );

  server.registerTool(
    'neuron_trace_last',
    {
      description: 'Last Neuron operation trace (what ran — redacted, local only).',
      inputSchema: traceLastSchema,
    },
    async (args) => handleTraceLast(runtime, args),
  );

  server.registerTool(
    'neuron_explain_reasoning',
    {
      description:
        'Explain why Neuron suggested something — reasoning path + confidence (internal debugger).',
      inputSchema: explainReasoningSchema,
    },
    async (args) => handleExplainReasoning(runtime, args),
  );

  server.registerTool(
    'neuron_trace_context',
    {
      description:
        'Context / memories used in the last traced operation. (For incidents use neuron_debug_context.)',
      inputSchema: traceContextSchema,
    },
    async (args) => handleTraceContext(runtime, args),
  );

  server.registerTool(
    'neuron_performance_metrics',
    {
      description:
        'Local Neuron performance metrics: scan, retrieval, graph, model latency (no cloud).',
      inputSchema: performanceMetricsSchema,
    },
    async (args) => handlePerformanceMetrics(runtime, args),
  );

  server.registerTool(
    'neuron_observability_debug',
    {
      description:
        'Toggle observability debug mode / retention, optional demo trace, write neuron-report.md.',
      inputSchema: observabilityDebugSchema,
    },
    async (args) => handleObservabilityDebug(runtime, args),
  );

  server.registerTool(
    'neuron_security_scan',
    {
      description:
        'Full Neuron self-protection scan: secrets, injection, trust (writes security-report.md).',
      inputSchema: securityScanCoreSchema,
    },
    async (args) => handleSecurityScan(runtime, args),
  );

  server.registerTool(
    'neuron_check_context',
    {
      description:
        'Sanitize and check text before AI — secrets redacted, injection patterns flagged.',
      inputSchema: checkContextSchema,
    },
    async (args) => handleCheckContext(runtime, args),
  );

  server.registerTool(
    'neuron_trust_report',
    {
      description: 'Source trust report (file/history/location) — LIMITED trust for fresh README etc.',
      inputSchema: trustReportSchema,
    },
    async (args) => handleTrustReport(runtime, args),
  );

  server.registerTool(
    'neuron_audit_log',
    {
      description: 'Local security audit history: blocked actions, sanitization, permission changes.',
      inputSchema: auditLogSchema,
    },
    async (args) => handleAuditLog(runtime, args),
  );

  server.registerTool(
    'neuron_security_check',
    {
      description:
        'Pre-AI security check for Cursor: detect secrets, sanitize, optional MCP gate.',
      inputSchema: neuronSecurityCheckSchema,
    },
    async (args) => handleNeuronSecurityCheck(runtime, args),
  );

  server.registerTool(
    'neuron_workspace_info',
    {
      description:
        'Workspace / org / active project info (enterprise foundation — no SaaS).',
      inputSchema: workspaceInfoSchema,
    },
    async (args) => handleWorkspaceInfo(runtime, args),
  );

  server.registerTool(
    'neuron_project_switch',
    {
      description: 'Switch active project within the current workspace (MCP context isolation).',
      inputSchema: projectSwitchSchema,
    },
    async (args) => handleProjectSwitch(runtime, args),
  );

  server.registerTool(
    'neuron_access_check',
    {
      description:
        'Check workspace role permissions for memory, documents, decisions, security reports, …',
      inputSchema: accessCheckSchema,
    },
    async (args) => handleAccessCheck(runtime, args),
  );

  server.registerTool(
    'neuron_storage_status',
    {
      description:
        'Storage provider status + deployment mode (sqlite/postgres/file foundation).',
      inputSchema: storageStatusSchema,
    },
    async (args) => handleStorageStatus(runtime, args),
  );

  server.registerTool(
    'neuron_architecture_scan',
    {
      description:
        'Full architecture audit: dependencies, boundaries, rules, score → architecture-health.md.',
      inputSchema: architectureScanSchema,
    },
    async (args) => handleArchitectureScan(runtime, args),
  );

  server.registerTool(
    'neuron_dependency_graph',
    {
      description: 'Dependency map with circular dependency warnings.',
      inputSchema: dependencyGraphSchema,
    },
    async (args) => handleDependencyGraph(runtime, args),
  );

  server.registerTool(
    'neuron_refactor_plan',
    {
      description:
        'Refactoring plans (problem/impact/steps/risk/effort) — never auto-rewrites code.',
      inputSchema: refactorPlanSchema,
    },
    async (args) => handleRefactorPlan(runtime, args),
  );

  server.registerTool(
    'neuron_architecture_score',
    {
      description: 'Architecture Health score (coupling, complexity, tests, docs, security).',
      inputSchema: architectureScoreSchema,
    },
    async (args) => handleArchitectureScore(runtime, args),
  );

  server.registerTool(
    'neuron_architecture_review',
    {
      description:
        'Architecture Review mode: issues, risks, recommendations for a refactor (advisory).',
      inputSchema: architectureReviewToolSchema,
    },
    async (args) => handleArchitectureReview(runtime, args),
  );

  server.registerTool(
    'neuron_available_modes',
    {
      description:
        'List Neuron developer intelligence modes (architect, review, debug, security, …).',
      inputSchema: availableModesSchema,
    },
    async (args) => handleAvailableModes(runtime, args),
  );

  server.registerTool(
    'neuron_mode_context',
    {
      description: 'Show required context for a mode (e.g. security needs files + deps + rules).',
      inputSchema: modeContextSchema,
    },
    async (args) => handleModeContext(runtime, args),
  );

  server.registerTool(
    'neuron_run_mode',
    {
      description:
        'Run a specialized Neuron mode (auto-routes intent or explicit modeId). Advisory only.',
      inputSchema: runModeSchema,
    },
    async (args) => handleRunMode(runtime, args),
  );

  server.registerTool(
    'neuron_git_context',
    {
      description:
        'Git-derived change context (summaries only — no full patches/secrets). Optional ingest.',
      inputSchema: gitContextSchema,
    },
    async (args) => handleGitContext(runtime, args),
  );

  server.registerTool(
    'neuron_change_history',
    {
      description: 'Change history for a module/path from ingested commits.',
      inputSchema: changeHistorySchema,
    },
    async (args) => handleChangeHistory(runtime, args),
  );

  server.registerTool(
    'neuron_architecture_evolution',
    {
      description: 'Architecture evolution transitions (e.g. REST → GraphQL) + graph link hints.',
      inputSchema: architectureEvolutionSchema,
    },
    async (args) => handleArchitectureEvolution(runtime, args),
  );

  server.registerTool(
    'neuron_regression_check',
    {
      description:
        'Check if a change resembles prior problematic commits (advisory regression memory).',
      inputSchema: regressionCheckSchema,
    },
    async (args) => handleRegressionCheck(runtime, args),
  );

  server.registerTool(
    'neuron_history_context',
    {
      description:
        'Why is this code like this? Historical reason, related commits, decisions — not people blame.',
      inputSchema: historyContextSchema,
    },
    async (args) => handleHistoryContext(runtime, args),
  );

  void z;
}
