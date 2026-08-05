export type DocumentationType =
  | 'ARCHITECTURE_DOC'
  | 'API_DOC'
  | 'MODULE_DOC'
  | 'ONBOARDING_DOC'
  | 'DECISION_DOC'
  | 'SECURITY_DOC'
  | 'CHANGELOG'
  | 'PROJECT_OVERVIEW';

export type DocumentationSource = 'generated' | 'manual' | 'hybrid';
export type DocumentationStatus = 'DRAFT' | 'CURRENT' | 'STALE' | 'ARCHIVED';

export interface DocumentationArtifact {
  id: string;
  type: DocumentationType;
  source: DocumentationSource;
  /** Human path hint, e.g. .neuron/docs/architecture.md */
  path: string;
  title: string;
  content: string;
  generatedFrom: string[];
  lastUpdated: string;
  confidence: number;
  status: DocumentationStatus;
}

export interface DocFact {
  key: string;
  value: string;
  source: 'docs' | 'code' | 'brain';
  location?: string;
}

export interface DriftFinding {
  id: string;
  topic: string;
  documented: string;
  actual: string;
  recommendation: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DocumentationQualityScore {
  overall: number;
  accuracy: number;
  freshness: number;
  coverage: number;
  consistency: number;
  notes: string[];
}

export interface ModuleDocInput {
  name: string;
  purpose?: string;
  responsibilities?: string[];
  dependencies?: string[];
  api?: string[];
  securityNotes?: string[];
  knownIssues?: string[];
  relatedDecisions?: string[];
}

export interface DecisionDocInput {
  id: string;
  title: string;
  why: string;
  decision: string;
  alternatives?: string[];
  status?: string;
}

export interface ChangelogInput {
  commits?: string[];
  features?: string[];
  decisions?: string[];
  incidents?: string[];
}

export interface ApiRouteHint {
  method: string;
  path: string;
  permissions?: string[];
  schema?: string;
  businessContext?: string;
}

export interface ProjectBrainSnapshot {
  projectName?: string;
  modules?: string[];
  databases?: string[];
  frameworks?: string[];
  dependencies?: string[];
  decisions?: string[];
  incidents?: string[];
  securityNotes?: string[];
  architectureNotes?: string[];
  rules?: string[];
  mistakes?: string[];
  dataFlows?: string[];
}

export interface DocumentationStoreDocument {
  version: 1;
  artifacts: DocumentationArtifact[];
  drift: DriftFinding[];
  lastHealth?: DocumentationQualityScore;
  updatedAt: string;
}

export type ExportFormat = 'markdown' | 'html' | 'json';

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
