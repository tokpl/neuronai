export type {
  RiskSeverity,
  DebtPriority,
  EffortEstimate,
  DetectedPattern,
  ModuleNode,
  DependencyEdge,
  ArchitectureBoundary,
  ArchitectureRisk,
  ArchitectureSnapshot,
  CircularDependency,
  CouplingFinding,
  DependencyAnalysisResult,
  BoundaryFinding,
  ComplexityFinding,
  RuleViolation,
  TechnicalDebtItem,
  RefactoringPlan,
  ArchitectureHealthScore,
  ArchitectureDiffResult,
  ArchitectureReviewStoreDocument,
} from './types.js';
export { nowIso, newId, clampScore } from './types.js';

export * from './analysis/index.js';
export * from './rules/index.js';
export * from './metrics/index.js';
export * from './refactoring/index.js';
export * from './reports/index.js';
export * from './recommendations/index.js';
export {
  ArchitectureReviewEngine,
  createArchitectureReviewEngine,
  defaultNeuronModules,
  type ArchitectureScanInput,
  type ArchitectureScanResult,
} from './facade/architecture-review-engine.js';
