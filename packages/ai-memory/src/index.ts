export {
  MemoryClassifier,
  type ClassificationResult,
  type ClassifierLabel,
} from './classifier/memory-classifier.js';
export {
  MemoryExtractor,
  type ExtractedMemoryCandidate,
  type MemoryExtractorInput,
} from './extractor/memory-extractor.js';
export {
  ImportanceEngine,
  ImportancePolicy,
  type ImportanceAction,
  type ImportanceDecision,
  type ImportanceEngineInput,
  type ImportancePolicyThresholds,
} from './importance/importance-engine.js';
export {
  ConflictDetector,
  jaccardSimilarity,
  type ConflictKind,
  type ConflictReport,
} from './conflict/conflict-detector.js';
export {
  MemoryConsolidator,
  type ConsolidationGroup,
} from './consolidation/memory-consolidator.js';
export {
  HybridMemorySearchEngine,
  type MemorySearchEngine,
  type MemorySearchQuery,
  type RankedMemoryHit,
} from './search/memory-search-engine.js';
export {
  InMemoryJobQueue,
  type MemoryJob,
  type MemoryJobHandler,
  type MemoryJobQueue,
  type MemoryJobType,
} from './jobs/job-interfaces.js';
export {
  MemoryEvaluation,
  type MemoryEvaluationInput,
  type MemoryEvaluationReport,
  type RetrievalEvalCase,
} from './evaluation/memory-evaluation.js';
export {
  MemoryIntelligencePipeline,
  createMemoryIntelligencePipeline,
  type MemoryIntelligencePipelineDeps,
  type MemoryIntelligenceResult,
  type PipelineCandidateResult,
  type RawMemoryInput,
  type RawMemoryInputKind,
} from './pipeline/memory-intelligence-pipeline.js';
