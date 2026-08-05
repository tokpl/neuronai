export type {
  DocumentationType,
  DocumentationSource,
  DocumentationStatus,
  DocumentationArtifact,
  DocFact,
  DriftFinding,
  DocumentationQualityScore,
  ModuleDocInput,
  DecisionDocInput,
  ChangelogInput,
  ApiRouteHint,
  ProjectBrainSnapshot,
  DocumentationStoreDocument,
  ExportFormat,
} from './types.js';
export { nowIso, newId } from './types.js';

export {
  DocumentationAnalyzer,
  createDocumentationAnalyzer,
} from './analyzer/documentation-analyzer.js';
export {
  DocumentationDriftDetector,
  createDocumentationDriftDetector,
} from './analyzer/drift-detector.js';

export {
  ArchitectureDocGenerator,
  createArchitectureDocGenerator,
} from './generator/architecture-doc.js';
export { ModuleDocGenerator, createModuleDocGenerator } from './generator/module-doc.js';
export { OnboardingGenerator, createOnboardingGenerator } from './generator/onboarding.js';
export { APIAnalyzer, createAPIAnalyzer } from './generator/api-analyzer.js';
export { DecisionDocGenerator, createDecisionDocGenerator } from './generator/decision-doc.js';
export {
  SmartChangelogGenerator,
  createSmartChangelogGenerator,
} from './generator/changelog.js';

export {
  DocumentationQualityScorer,
  createDocumentationQualityScorer,
} from './quality/score.js';
export {
  DocumentationReviewer,
  createDocumentationReviewer,
} from './quality/reviewer.js';

export { DocumentationExporter, createDocumentationExporter } from './exports/exporter.js';
export { DocumentationSync, createDocumentationSync } from './sync/sync.js';

export {
  DocumentationIntelligence,
  createDocumentationIntelligence,
} from './facade/documentation-intelligence.js';
