import type { MemoryType } from '@neuronai/types';

import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';

export interface WorkflowRuleContext {
  analysis: CodeChangeAnalysis;
  commitMessage?: string;
  eventType?: string;
}

export interface WorkflowRuleHit {
  ruleId: string;
  name: string;
  boost: number;
  forceSuggest: boolean;
  preferredType?: MemoryType;
  reason: string;
}

export interface WorkflowRule {
  id: string;
  name: string;
  evaluate(ctx: WorkflowRuleContext): WorkflowRuleHit | null;
}

/**
 * Deterministic workflow rules that bias MemorySuggestionEngine.
 */
export const defaultWorkflowRules: WorkflowRule[] = [
  {
    id: 'module-blast-radius',
    name: 'Large module change',
    evaluate(ctx) {
      const byModule = new Map<string, number>();
      for (const path of ctx.analysis.paths) {
        const normalized = path.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        const dirs = parts.slice(0, -1);
        let mod = 'root';
        if (dirs[0] === 'src' || dirs[0] === 'apps' || dirs[0] === 'packages') {
          mod = dirs.slice(0, Math.min(2, dirs.length)).join('/') || 'root';
        } else if (dirs.length > 0) {
          mod = dirs.slice(0, Math.min(2, dirs.length)).join('/');
        }
        byModule.set(mod, (byModule.get(mod) ?? 0) + 1);
      }
      const hot = [...byModule.entries()].find(([, n]) => n > 5);
      if (!hot) return null;
      return {
        ruleId: 'module-blast-radius',
        name: 'Large module change',
        boost: 0.15,
        forceSuggest: true,
        preferredType: 'architecture_decision',
        reason: `Changed >5 files in module ${hot[0]} - suggest architecture review`,
      };
    },
  },
  {
    id: 'commit-keywords',
    name: 'Architecture commit keywords',
    evaluate(ctx) {
      const msg = ctx.commitMessage ?? '';
      if (!/\b(refactor|migration|architecture|rewrite)\b/i.test(msg)) return null;
      return {
        ruleId: 'commit-keywords',
        name: 'Architecture commit keywords',
        boost: 0.2,
        forceSuggest: true,
        preferredType: 'architecture_decision',
        reason: 'Commit message indicates refactor/migration/architecture/rewrite',
      };
    },
  },
  {
    id: 'dependency-added',
    name: 'Dependency change',
    evaluate(ctx) {
      if (!ctx.analysis.hasDependencyChange) return null;
      return {
        ruleId: 'dependency-added',
        name: 'Dependency change',
        boost: 0.12,
        forceSuggest: true,
        preferredType: 'dependency',
        reason: 'New or changed dependency detected - consider recording the decision',
      };
    },
  },
  {
    id: 'schema-migration',
    name: 'Database schema change',
    evaluate(ctx) {
      if (!ctx.analysis.hasSchemaChange) return null;
      return {
        ruleId: 'schema-migration',
        name: 'Database schema change',
        boost: 0.25,
        forceSuggest: true,
        preferredType: 'architecture_decision',
        reason: 'Database schema / migration changed - always suggest memory',
      };
    },
  },
  {
    id: 'auth-surface',
    name: 'Auth / permissions surface',
    evaluate(ctx) {
      if (!ctx.analysis.hasAuthChange) return null;
      return {
        ruleId: 'auth-surface',
        name: 'Auth / permissions surface',
        boost: 0.18,
        forceSuggest: true,
        preferredType: 'architecture_decision',
        reason: 'Authentication / permission-related files changed',
      };
    },
  },
];

export class WorkflowRulesEngine {
  constructor(private readonly rules: WorkflowRule[] = defaultWorkflowRules) {}

  evaluate(ctx: WorkflowRuleContext): WorkflowRuleHit[] {
    const hits: WorkflowRuleHit[] = [];
    for (const rule of this.rules) {
      const hit = rule.evaluate(ctx);
      if (hit) hits.push(hit);
    }
    return hits;
  }
}

export function createWorkflowRulesEngine(rules?: WorkflowRule[]): WorkflowRulesEngine {
  return new WorkflowRulesEngine(rules);
}
