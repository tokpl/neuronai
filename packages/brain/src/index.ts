export type {
  BrainPaths,
  BrainPrefs,
  BrainStatus,
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
export type { ModificationAdvice } from './retrieval/recommend.js';
