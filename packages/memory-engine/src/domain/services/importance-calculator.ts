import type {
  MemoryType as MemoryTypeValue,
  MemorySource as MemorySourceValue,
} from '@neuronai/types';

export interface ImportanceCalculatorInput {
  type: MemoryTypeValue;
  contentLength: number;
  source: MemorySourceValue;
  /** Optional manual override 0..1 */
  manualImportance?: number;
}

/**
 * Deterministic importance scoring (no AI).
 * Designed to be replaced by an AI-backed calculator later.
 */
export interface ImportanceCalculator {
  calculate(input: ImportanceCalculatorInput): number;
}

const TYPE_PRIOR: Record<MemoryTypeValue, number> = {
  architecture_decision: 0.92,
  mistake: 0.88,
  business_rule: 0.85,
  pattern: 0.72,
  dependency: 0.68,
  knowledge: 0.65,
  context: 0.25,
};

const SOURCE_BONUS: Record<MemorySourceValue, number> = {
  manual: 0.05,
  documentation: 0.04,
  user: 0.03,
  git: 0.02,
  agent: 0,
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export class DefaultImportanceCalculator implements ImportanceCalculator {
  calculate(input: ImportanceCalculatorInput): number {
    if (input.manualImportance !== undefined) {
      return clamp01(input.manualImportance);
    }

    const prior = TYPE_PRIOR[input.type];
    const lengthFactor = clamp01(input.contentLength / 400) * 0.08;
    const sourceBonus = SOURCE_BONUS[input.source];
    return clamp01(Number((prior + lengthFactor + sourceBonus).toFixed(4)));
  }
}
