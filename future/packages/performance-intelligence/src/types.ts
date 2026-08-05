export type PerformanceMemoryType =
  | 'DATABASE'
  | 'API'
  | 'FRONTEND'
  | 'BACKEND'
  | 'INFRASTRUCTURE';

export type PerformanceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PerformanceStatus = 'OPEN' | 'ACKNOWLEDGED' | 'OPTIMIZED' | 'WONT_FIX';

export interface PerformanceMemory {
  id: string;
  type: PerformanceMemoryType;
  description: string;
  impact: string;
  severity: PerformanceSeverity;
  confidence: number;
  affectedModules: string[];
  solution: string | null;
  status: PerformanceStatus;
  recommendation?: string;
  relatedIncidentIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceFinding {
  id: string;
  type: PerformanceMemoryType;
  title: string;
  detail: string;
  severity: PerformanceSeverity;
  confidence: number;
  recommendation: string;
  evidence: string[];
}

export interface ScalabilityWarning {
  id: string;
  module: string;
  dependsOn: string;
  warning: string;
  recommendation: string;
  severity: PerformanceSeverity;
}

export interface ProjectScaleProfile {
  expectedUsers?: string;
  trafficPatterns: string[];
  criticalFlows: string[];
  notes: string[];
  updatedAt: string;
}

export interface OptimizationRecord {
  id: string;
  problem: string;
  solution: string;
  result: string;
  module?: string;
  beforeMetric?: string;
  afterMetric?: string;
  createdAt: string;
}

export interface BenchmarkCompareSnapshot {
  id: string;
  label: string;
  phase: 'before' | 'after';
  notes: string[];
  metrics: Record<string, number | string>;
  createdAt: string;
}

export interface PerformanceChangeImpact {
  impact: PerformanceSeverity;
  reasons: string[];
  risks: string[];
  affectedAreas: Array<'response_time' | 'memory' | 'database_load' | 'frontend_bundle'>;
  findings: PerformanceFinding[];
}

export interface PerformanceReviewResult {
  findings: PerformanceFinding[];
  scalability: ScalabilityWarning[];
  memories: PerformanceMemory[];
  profile: ProjectScaleProfile;
  optimizations: OptimizationRecord[];
  relatedIncidents: Array<{ id: string; title: string }>;
  note: string;
}

export interface PerformanceStoreDocument {
  version: 1;
  memories: PerformanceMemory[];
  optimizations: OptimizationRecord[];
  profile: ProjectScaleProfile;
  benchmarks: BenchmarkCompareSnapshot[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
