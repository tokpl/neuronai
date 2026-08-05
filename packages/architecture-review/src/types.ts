/** Architecture audit types — proposals only, no auto-refactor. */

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DebtPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type EffortEstimate = 'S' | 'M' | 'L' | 'XL';

export type DetectedPattern =
  | 'repository'
  | 'service'
  | 'event_driven'
  | 'dependency_injection'
  | 'unknown';

export interface ModuleNode {
  id: string;
  name: string;
  layer?: 'core' | 'application' | 'security' | 'storage' | 'other';
  responsibilities?: string[];
  fileCount?: number;
  loc?: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  kind?: 'import' | 'package' | 'module';
}

export interface ArchitectureBoundary {
  moduleId: string;
  expectedResponsibilities: string[];
  observedResponsibilities: string[];
}

export interface ArchitectureRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  location?: string;
}

export interface ArchitectureSnapshot {
  modules: ModuleNode[];
  dependencies: DependencyEdge[];
  boundaries: ArchitectureBoundary[];
  patterns: DetectedPattern[];
  risks: ArchitectureRisk[];
  timestamp: string;
  label?: string;
}

export interface CircularDependency {
  cycle: string[];
  warning: string;
}

export interface CouplingFinding {
  moduleId: string;
  fanIn: number;
  fanOut: number;
  highCoupling: boolean;
}

export interface DependencyAnalysisResult {
  edges: DependencyEdge[];
  circular: CircularDependency[];
  coupling: CouplingFinding[];
  unusedModules: string[];
}

export interface BoundaryFinding {
  moduleId: string;
  issue: string;
  recommendation: string;
}

export interface ComplexityFinding {
  location: string;
  kind: 'large_file' | 'large_function' | 'deep_nesting' | 'duplicate_logic';
  metric: number;
  detail: string;
}

export interface RuleViolation {
  ruleId: string;
  severity: RiskSeverity;
  message: string;
  location?: string;
}

export interface TechnicalDebtItem {
  id: string;
  issue: string;
  impact: string;
  location: string;
  priority: DebtPriority;
  history: Array<{ at: string; note: string }>;
}

export interface RefactoringPlan {
  id: string;
  problem: string;
  impact: string;
  suggestedSteps: string[];
  risk: string;
  estimatedEffort: EffortEstimate;
  location?: string;
}

export interface ArchitectureHealthScore {
  score: number;
  coupling: number;
  complexity: number;
  testCoverage: number;
  documentation: number;
  security: number;
  breakdown: string[];
}

export interface ArchitectureDiffResult {
  beforeLabel?: string;
  afterLabel?: string;
  scoreDelta: number;
  regressions: string[];
  improvements: string[];
}

export interface ArchitectureReviewStoreDocument {
  version: 1;
  snapshots: ArchitectureSnapshot[];
  debt: TechnicalDebtItem[];
  lastScore?: ArchitectureHealthScore;
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
