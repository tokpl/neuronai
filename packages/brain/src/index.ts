export type {
  BrainPaths,
  BrainPrefs,
  BrainStatus,
  DeliverGateState,
  DeliverPlaybook,
  DeliverSignals,
  WorkflowBoard,
  WorkflowPrefs,
  ProjectMap,
  ProjectMapEntry,
  ProjectMapKind,
  DnaConventions,
  DnaIdentity,
  DnaMeta,
  DnaPlatforms,
  DnaRisk,
  DnaStack,
  DnaStructure,
  Facet,
  FacetSource,
  KnowledgeGraph,
  KnowledgePlane,
  ProjectDna,
  ProjectHealth,
  Provenance,
} from './models.js';
export type {
  CodeEdge,
  CodeEdgeType,
  CodeEvidence,
  CodeFileNode,
  CodeIntelligence,
  CodeSymbolKind,
  CodeSymbolNode,
  RelationConfidence,
} from '@neuronai/types';
export { resolveBrainPaths } from './paths.js';
export { computeHealth, emptyDna, emptyHealth, emptyKnowledge, facet, nowIso } from './defaults.js';
export { openProjectBrain, ProjectBrain, type OpenProjectBrainOptions } from './project-brain.js';
export type { BrainQueryHit, LearnOutcome } from './api.js';
export {
  categoryLabel,
  categoryFromMemoryType,
  classifyKnowledge,
  isPermanentCategory,
  memoryTypeForCategory,
  type BrainKnowledgeCategory,
  type ClassifySignals,
} from './categories.js';
export {
  computeBrainMetrics,
  explainMetric,
  formatBrainMetricsReport,
  type BrainMetric,
  type BrainMetricsSnapshot,
  type LastCompressionSample,
  type MetricKind,
  type MetricsInput,
} from './metrics.js';

// Retrieval — relevance and ranking.
export {
  brainDocs,
  memoryDocs,
  parseQuery,
  retrieve,
  stem,
  tokenize,
  type BrainDocSource,
  type ParsedQuery,
  type RetrievalDoc,
  type RetrievalHit,
  type RetrievalKind,
  type RetrievalOptions,
  type RetrievalResult,
  type RetrievalStats,
} from './retrieval/index.js';
export { expandConnectedSlice, codeDocs } from './retrieval/code-docs.js';
export {
  explainFlow,
  explainSymbol,
  findSymbols,
  getDependencies,
  getDependents,
  getImpact,
  getSymbol,
  type CodeFlowStep,
  type CodeImpact,
  type CodeImpactItem,
} from './code/queries.js';

// Deduplication — one memory per piece of knowledge.
export {
  contentFingerprint,
  dedupeRecords,
  findDuplicate,
  mergeRecords,
  similarity,
  DEFAULT_SIMILARITY_THRESHOLD,
  type DedupableRecord,
  type DedupeMerge,
  type DedupeResult,
  type DuplicateMatch,
} from './dedupe.js';

// Compiler — context selection and compression.
export {
  BrainCompiler,
  createBrainCompiler,
  preparationProfile,
  resolvePreparationMode,
  PREPARATION_TOKEN_BUDGETS,
  estimateTokens,
  explainCompressionMetric,
  type BrainCompileInput,
  type CompiledContext,
  type CompiledSource,
  type CompressionMetrics,
  type PreparationMode,
  type PreparationModeResolved,
} from './compiler/index.js';

// The single path from stored knowledge to agent-facing context.
export {
  prepareContext,
  type ContextEfficiency,
  type PrepareContextInput,
  type PreparedContext,
  type RelevantLocation,
  type RelevantRule,
} from './context.js';
export {
  buildClarifyPlan,
  type BuildClarifyInput,
  type ClarifyAskQuestion,
  type ClarifyOption,
  type ClarifyPlan,
  type ClarifyQuestion,
  type ContextGate,
} from './clarify.js';
export {
  draftClarifyMemory,
  type ClarifyAnswerInput,
  type ClarifyMemoryDraft,
} from './clarify-resolve.js';
export {
  importMemoryMarkdown,
  syncMemoryMarkdown,
} from './memory-files.js';
export {
  detectConventions,
  isPrimed,
  runPrime,
  type DetectedConventions,
  type PrimeResult,
} from './workflow/prime.js';
export {
  emptyBoard,
  readWorkflowBoard,
  writeWorkflowBoard,
  assertBoardTransition,
  boardHealth,
  sortWavesByDepends,
  WorkflowBoardError,
} from './workflow/board.js';
export {
  answerDeliverGate,
  clearDeliverGate,
  gateBlocksExecute,
  isGateActive,
  readDeliverGate,
  writeDeliverGate,
} from './workflow/gate.js';
export {
  playbookChecklist,
  checklistComplete,
  missingChecklistIds,
  missingEvidenceNotes,
  playbookRequiresEvidenceNotes,
  type PlaybookChecklistItem,
} from './workflow/playbooks.js';
export {
  proposeDeliverWaves,
  type ProposeWavesInput,
  type ProposedWave,
  type ProposeQuality,
} from './workflow/propose-waves.js';
export {
  applyRunbook,
  detectRunbook,
  isDeliverRunbook,
  DELIVER_RUNBOOKS,
  type DeliverRunbook,
} from './workflow/runbooks.js';
export {
  buildOrientationMap,
  formatOrientationMarkdown,
  shouldEmitOrientation,
  type OrientationMap,
} from './orientation.js';
export {
  appendDeliverHistory,
  readDeliverHistory,
  type DeliverHistoryEntry,
} from './workflow/history.js';
export { writeLastDeliverMd } from './workflow/last-deliver.js';
export { detectPlaybook } from './clarify.js';
export {
  extractReferencedPaths,
  findStaleMemories,
  type DecayFinding,
} from './decay.js';
export { applyDecayFix, type DecayFixResult } from './decay-fix.js';
export {
  buildContextContribution,
  formatContributionTokens,
  CONTRIBUTION_EMOJI,
  type ContextContribution,
} from './contribution.js';
export type { ModificationAdvice } from './retrieval/recommend.js';
