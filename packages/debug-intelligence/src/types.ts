export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'ARCHIVED';

export interface IncidentLink {
  kind: 'file' | 'commit' | 'developer' | 'decision' | 'rule' | 'module';
  ref: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedModules: string[];
  rootCause: string | null;
  solution: string | null;
  preventiveActions: string[];
  lesson: string | null;
  links: IncidentLink[];
  errorSignature?: string;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

export interface IncidentMemory {
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  lesson: string;
  incidentId: string;
}

export interface PossibleCause {
  rank: number;
  cause: string;
  confidence: number;
  evidence: string[];
}

export interface RootCauseReport {
  query: string;
  causes: PossibleCause[];
  relatedIncidentIds: string[];
}

export interface ErrorPattern {
  id: string;
  errorType: string;
  signature: string;
  commonCauses: string[];
  solutions: string[];
}

export interface RegressionMatch {
  current: string;
  priorIncidentId: string;
  priorTitle: string;
  similarity: number;
  message: string;
}

export interface FixValidationResult {
  fixedLikely: boolean;
  architectureOk: boolean;
  collateralRisk: string[];
  summary: string;
  requiresHumanConfirm: true;
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind: 'feature' | 'bug' | 'commit' | 'incident' | 'fix';
  title: string;
  detail: string;
}

export interface DebugSession {
  id: string;
  query: string;
  errorMessage?: string;
  stackTrace?: string;
  changedFiles: string[];
  relatedMemories: string[];
  relatedIncidents: Incident[];
  possibleCauses: PossibleCause[];
  regressions: RegressionMatch[];
  riskFactors: string[];
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface AutoDetectCandidate {
  kind: 'repeated_error' | 'failed_test' | 'production_signal';
  title: string;
  detail: string;
  requiresConfirmation: true;
}

export interface IncidentStoreDocument {
  version: 1;
  incidents: Incident[];
  patterns: ErrorPattern[];
  timeline: TimelineEvent[];
  sessions: DebugSession[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
