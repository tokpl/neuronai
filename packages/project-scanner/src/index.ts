export type {
  ScanMode,
  FileImportance,
  SupportedLanguage,
  ScannedFile,
  ProjectStackProfile,
  DependencyEdge,
  ArchitectureMap,
  CodeRelationship,
  GitInsight,
  DocInsight,
  GeneratedMemory,
  SuggestedRule,
  ScanCacheEntry,
  ScanDelta,
  ProjectMapEntry,
  ProjectMapSnapshot,
  ProjectScanReport,
  ScanOptions,
} from './types.js';
export { nowIso } from './types.js';
export { buildProjectMap, type ScanMapEntry, type ScanProjectMap } from './map/builder.js';
export { extractSymbols } from './symbols/extractor.js';

export {
  FileImportanceAnalyzer,
  createFileImportanceAnalyzer,
} from './filesystem/importance.js';
export { CodebaseScanner, createCodebaseScanner } from './filesystem/scanner.js';
export { LanguageRegistry, createLanguageRegistry } from './languages/registry.js';
export { SensitiveFileDetector, createSensitiveFileDetector } from './security/sensitive.js';
export { TechnologyDetector, createTechnologyDetector } from './frameworks/technology.js';
export { DependencyGraphBuilder, createDependencyGraphBuilder } from './dependencies/graph.js';
export { ArchitectureAnalyzer, createArchitectureAnalyzer } from './architecture/analyzer.js';
export {
  CodeRelationshipAnalyzer,
  createCodeRelationshipAnalyzer,
} from './architecture/relationships.js';
export { GitAnalyzer, createGitAnalyzer } from './git/analyzer.js';
export { DocumentationAnalyzer, createDocumentationAnalyzer } from './documentation/analyzer.js';
export { InitialMemoryGenerator, createInitialMemoryGenerator } from './memory/generator.js';
export { IncrementalScanner, createIncrementalScanner } from './incremental/scanner.js';
export {
  ProjectBrainWriter,
  createProjectBrainWriter,
  renderProjectReport,
} from './brain/writer.js';
export {
  ProjectBrainBootstrap,
  createProjectBrainBootstrap,
} from './facade/bootstrap.js';

/** MERGE: project-analyzer APIs re-exported from scanner for a single DX surface. */
export {
  createProjectResolver,
  detectProjectStack,
  collectProjectSignals,
  type ResolvedProject,
  type ProjectResolver,
  type StackDetection,
  type ProjectSignals,
} from '@neuronai/project-analyzer';
