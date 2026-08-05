import type { MemoryType, MemorySource } from '@neuronai/types';

export interface ImportanceEngineInput {
  type: MemoryType;
  content: string;
  source: MemorySource;
  confidence: number;
  /** 0..1 estimated blast radius / project impact */
  projectImpact?: number;
  /** 0..1 estimated future usefulness */
  futureUsefulness?: number;
  /** how often similar signal appeared */
  frequency?: number;
  manualImportance?: number;
}

export type ImportanceAction = 'auto_save' | 'ask_user' | 'reject';

export interface ImportanceDecision {
  score: number;
  action: ImportanceAction;
  rationale: string;
}

export interface ImportancePolicyThresholds {
  autoSave: number;
  askUser: number;
}

export class ImportancePolicy {
  constructor(
    private readonly thresholds: ImportancePolicyThresholds = {
      autoSave: 0.75,
      askUser: 0.45,
    },
  ) {}

  decide(score: number): ImportanceAction {
    if (score >= this.thresholds.autoSave) return 'auto_save';
    if (score >= this.thresholds.askUser) return 'ask_user';
    return 'reject';
  }
}

const TYPE_PRIOR: Record<MemoryType, number> = {
  architecture_decision: 0.92,
  mistake: 0.88,
  business_rule: 0.85,
  pattern: 0.72,
  dependency: 0.68,
  knowledge: 0.65,
  context: 0.2,
};

const SOURCE_WEIGHT: Record<MemorySource, number> = {
  manual: 0.06,
  documentation: 0.05,
  user: 0.04,
  git: 0.03,
  agent: 0.01,
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Expanded importance engine (still deterministic; AI can override via manualImportance).
 */
export class ImportanceEngine {
  constructor(private readonly policy = new ImportancePolicy()) {}

  score(input: ImportanceEngineInput): ImportanceDecision {
    if (input.manualImportance !== undefined) {
      const score = clamp01(input.manualImportance);
      return {
        score,
        action: this.policy.decide(score),
        rationale: 'manual override',
      };
    }

    const prior = TYPE_PRIOR[input.type];
    const impact = (input.projectImpact ?? defaultImpact(input.type)) * 0.12;
    const future = (input.futureUsefulness ?? defaultFuture(input.type)) * 0.1;
    const frequency = clamp01(input.frequency ?? 0) * 0.05;
    const confidenceBoost = (input.confidence - 0.5) * 0.08;
    const source = SOURCE_WEIGHT[input.source];
    const lengthPenalty = input.content.trim().length < 40 ? -0.08 : 0;

    const score = clamp01(
      Number(
        (prior + impact + future + frequency + confidenceBoost + source + lengthPenalty).toFixed(4),
      ),
    );

    const action = this.policy.decide(score);
    return {
      score,
      action,
      rationale: `type=${input.type} action=${action}`,
    };
  }
}

function defaultImpact(type: MemoryType): number {
  if (type === 'architecture_decision' || type === 'mistake') return 0.9;
  if (type === 'context') return 0.15;
  return 0.55;
}

function defaultFuture(type: MemoryType): number {
  if (type === 'architecture_decision' || type === 'pattern') return 0.9;
  if (type === 'context') return 0.1;
  return 0.6;
}
