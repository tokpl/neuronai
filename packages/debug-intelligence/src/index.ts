export type {
  IncidentSeverity,
  IncidentStatus,
  IncidentLink,
  Incident,
  IncidentMemory,
  PossibleCause,
  RootCauseReport,
  ErrorPattern,
  RegressionMatch,
  FixValidationResult,
  TimelineEvent,
  DebugSession,
  AutoDetectCandidate,
  IncidentStoreDocument,
} from './types.js';
export { nowIso, newId } from './types.js';

export { IncidentRegistry, createIncidentRegistry } from './incidents/registry.js';
export { IncidentMemoryFactory, createIncidentMemoryFactory } from './incidents/memory.js';
export { RootCauseAnalyzer, createRootCauseAnalyzer } from './analysis/root-cause.js';
export {
  ErrorPatternDatabase,
  createErrorPatternDatabase,
  DEFAULT_ERROR_PATTERNS,
} from './patterns/database.js';
export { RegressionAnalyzer, createRegressionAnalyzer } from './diagnostics/regression.js';
export {
  AutomaticIncidentDetector,
  createAutomaticIncidentDetector,
} from './diagnostics/auto-detect.js';
export { FixValidator, createFixValidator } from './resolution/fix-validator.js';
export { IncidentTimeline, createIncidentTimeline } from './timeline/timeline.js';
export { DebugSessionManager, createDebugSessionManager } from './session/manager.js';
export {
  DebugIntelligence,
  createDebugIntelligence,
} from './facade/debug-intelligence.js';
