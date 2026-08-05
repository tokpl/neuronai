export type {
  ProjectEventType,
  ChangeImportance,
  ProjectEvent,
  FileChangeInsight,
  GitCommitInsight,
  ArchitectureDriftFinding,
  MemorySuggestion,
  TimelineEntry,
  LiveProjectHealth,
  ContinuousState,
} from './types.js';
export { nowIso, newId } from './types.js';

export { ProjectEventBus, createProjectEventBus } from './events/bus.js';
export {
  SensitiveChangeFilter,
  createSensitiveChangeFilter,
} from './analyzers/sensitive-filter.js';
export {
  ChangeImportanceAnalyzer,
  createChangeImportanceAnalyzer,
} from './analyzers/importance.js';
export { FileChangeAnalyzer, createFileChangeAnalyzer } from './analyzers/file-change.js';
export { GitIntelligence, createGitIntelligence } from './analyzers/git-intelligence.js';
export {
  ArchitectureDriftDetector,
  createArchitectureDriftDetector,
  type DriftRule,
} from './analyzers/drift.js';
export {
  MemorySuggestionEngine,
  createMemorySuggestionEngine,
} from './recommendations/suggestions.js';
export { ProjectTimeline, createProjectTimeline } from './timeline/timeline.js';
export {
  ContinuousUpdateEngine,
  createContinuousUpdateEngine,
} from './updates/engine.js';
export { NeuronWatchMode, createNeuronWatchMode } from './watcher/watch-mode.js';
export {
  ContinuousProjectIntelligence,
  createContinuousProjectIntelligence,
} from './facade/continuous.js';
