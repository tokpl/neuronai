export type BudgetComplexity = 'small' | 'standard' | 'large' | 'architecture';

export interface ContextBudgetPlan {
  complexity: BudgetComplexity;
  maxTokens: number;
  maxItems: number;
  snippetChars: number;
  description: string;
}

const PLANS: Record<BudgetComplexity, Omit<ContextBudgetPlan, 'complexity'>> = {
  small: {
    maxTokens: 1_500,
    maxItems: 5,
    snippetChars: 160,
    description: 'Small fix - minimal context',
  },
  standard: {
    maxTokens: 5_000,
    maxItems: 10,
    snippetChars: 220,
    description: 'Feature - balanced context',
  },
  large: {
    maxTokens: 8_000,
    maxItems: 14,
    snippetChars: 260,
    description: 'Cross-cutting change',
  },
  architecture: {
    maxTokens: 15_000,
    maxItems: 24,
    snippetChars: 320,
    description: 'Architecture review - full graph-oriented context',
  },
};

/**
 * Controls how many tokens enter the agent context for Cursor / MCP.
 */
export class ContextBudgetManager {
  plan(
    complexity: BudgetComplexity,
    options: { availableTokens?: number; agentMode?: string } = {},
  ): ContextBudgetPlan {
    let base = { complexity, ...PLANS[complexity] };

    if (options.agentMode === 'fast') {
      base = {
        ...base,
        maxTokens: Math.min(base.maxTokens, 2_000),
        maxItems: Math.min(base.maxItems, 6),
      };
    }
    if (options.agentMode === 'architect' || options.agentMode === 'refactor') {
      base = {
        ...base,
        complexity: 'architecture',
        ...PLANS.architecture,
      };
    }
    if (options.availableTokens !== undefined) {
      base = {
        ...base,
        maxTokens: Math.min(base.maxTokens, Math.max(500, options.availableTokens)),
      };
    }
    return base;
  }
}

export function createContextBudgetManager(): ContextBudgetManager {
  return new ContextBudgetManager();
}
