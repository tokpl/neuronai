import { randomUUID } from 'node:crypto';

export type RuleCategory =
  | 'ARCHITECTURE'
  | 'CODING_STYLE'
  | 'SECURITY'
  | 'DATABASE'
  | 'TESTING'
  | 'DEPLOYMENT';

export type RuleSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type RuleSource = 'manual' | 'generated' | 'learned';

export type RuleStatus = 'suggested' | 'approved' | 'active' | 'rejected' | 'outdated';

export interface ConstitutionRule {
  id: string;
  category: RuleCategory;
  rule: string;
  severity: RuleSeverity;
  confidence: number;
  source: RuleSource;
  status: RuleStatus;
  rationale?: string;
  relatedMemoryIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DecisionEvolutionEntry {
  id: string;
  title: string;
  currentState: string;
  history: Array<{
    version: number;
    state: string;
    reason: string;
    at: string;
  }>;
  memoryId?: string;
  updatedAt: string;
}

export interface TechDebtItem {
  id: string;
  title: string;
  detail: string;
  kind: 'todo' | 'deprecated' | 'workaround' | 'temporary';
  reminder?: string;
  relatedPath?: string;
  createdAt: string;
}

export interface MistakeRecord {
  id: string;
  title: string;
  detail: string;
  relatedModule?: string;
  memoryId?: string;
  createdAt: string;
}

export interface ProjectConstitutionDocument {
  version: 1;
  projectId: string;
  projectName: string;
  updatedAt: string;
  rules: ConstitutionRule[];
  decisions: DecisionEvolutionEntry[];
  mistakes: MistakeRecord[];
  techDebt: TechDebtItem[];
  lastReviewAt?: string | null;
  commitsSinceReview?: number;
}

export function createEmptyConstitution(
  projectId: string,
  projectName: string,
): ProjectConstitutionDocument {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectId,
    projectName,
    updatedAt: now,
    rules: [],
    decisions: [],
    mistakes: [],
    techDebt: [],
    lastReviewAt: null,
    commitsSinceReview: 0,
  };
}

export function newRuleId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
