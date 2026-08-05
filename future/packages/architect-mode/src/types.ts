export type ArchitectModeKind = 'NORMAL' | 'ARCHITECT' | 'REVIEW' | 'DEBUG';

export type ComplexityLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ProjectMemoryContext {
  decisions?: string[];
  patterns?: string[];
  mistakes?: string[];
  constitution?: string[];
  modules?: string[];
  graphEdges?: Array<{ from: string; to: string }>;
}

export interface RequirementAnalysis {
  raw: string;
  feature: string;
  affected: string[];
  complexity: ComplexityLevel;
  risk: RiskLevel;
  questions: string[];
}

export interface SolutionOption {
  id: string;
  title: string;
  summary: string;
  pros: string[];
  cons: string[];
}

export interface ArchitectureProposal {
  recommendation: string;
  recommendedOptionId: string;
  options: SolutionOption[];
  existingSystem: string[];
  understanding: string;
}

export interface ImplementationPlanStep {
  order: number;
  title: string;
  detail: string;
}

export interface ImplementationPlan {
  task: string;
  steps: ImplementationPlanStep[];
}

export interface RiskAnalysis {
  level: RiskLevel;
  reasons: string[];
  categories: {
    breakingChanges: string[];
    security: string[];
    performance: string[];
    maintenance: string[];
  };
}

export interface DependencyImpact {
  root: string;
  affected: string[];
}

export interface ArchitectureDecisionRecord {
  id: string;
  title: string;
  decision: string;
  reason: string;
  status: 'Pending approval' | 'Accepted' | 'Rejected';
  alternatives: string[];
  consequences: string[];
  createdAt: string;
}

export interface ImplementationReview {
  planCompliance: number;
  architectureCompliance: number;
  issues: string[];
  missingTests: boolean;
  duplicatedLogic: string[];
  brokenPatterns: string[];
  summary: string;
}

export interface ArchitectureScoreSnapshot {
  before: number;
  after: number;
  delta: number;
  reason: string;
}

export interface ArchitectSessionInput {
  request: string;
  mode?: ArchitectModeKind;
  memory?: ProjectMemoryContext;
  /** Files / modules touched by an implementation (for review) */
  changedPaths?: string[];
  /** Diff or change summary text */
  changeSummary?: string;
  /** Optional prior plan steps for compliance check */
  priorPlan?: ImplementationPlan;
  /** Score before change */
  scoreBefore?: number;
}

export interface ArchitectReport {
  mode: ArchitectModeKind;
  requirement: RequirementAnalysis;
  proposal: ArchitectureProposal;
  plan: ImplementationPlan;
  risk: RiskAnalysis;
  impact: DependencyImpact;
  adr: ArchitectureDecisionRecord;
  review?: ImplementationReview;
  score?: ArchitectureScoreSnapshot;
  markdown: string;
  generatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
