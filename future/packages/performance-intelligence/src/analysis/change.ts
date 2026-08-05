import type { PerformanceChangeImpact, PerformanceFinding } from '../types.js';
import { newId } from '../types.js';

/**
 * Git-diff performance impact advisor — not a profiler.
 */
export class PerformanceChangeAnalyzer {
  analyze(input: {
    diff?: string;
    changedPaths?: string[];
  }): PerformanceChangeImpact {
    const blob = `${input.diff ?? ''}\n${(input.changedPaths ?? []).join('\n')}`.toLowerCase();
    const reasons: string[] = [];
    const risks: string[] = [];
    const affectedAreas: PerformanceChangeImpact['affectedAreas'] = [];
    const findings: PerformanceFinding[] = [];

    if (/prisma|typeorm|sequelize|knex|sql|migration|query/.test(blob)) {
      affectedAreas.push('database_load');
      reasons.push('Database / ORM related change');
      risks.push('Query volume or index usage may change');
      findings.push(mk('DATABASE', 'DB surface changed', 'HIGH', 'Review query plans and indexes'));
    }
    if (/controller|route|endpoint|handler|middleware|graphql/.test(blob)) {
      affectedAreas.push('response_time');
      reasons.push('API / handler change');
      risks.push('Latency on critical endpoints may regress');
      findings.push(mk('API', 'API path changed', 'MEDIUM', 'Check pagination and payload size'));
    }
    if (/react|vue|angular|next\.|component|webpack|vite|bundle/.test(blob)) {
      affectedAreas.push('frontend_bundle');
      reasons.push('Frontend / bundle related change');
      risks.push('Bundle size or render cost may increase');
      findings.push(mk('FRONTEND', 'UI bundle surface changed', 'MEDIUM', 'Watch bundle and memoization'));
    }
    if (/buffer|stream|worker|cache|memory|heap|alloc/.test(blob)) {
      affectedAreas.push('memory');
      reasons.push('Memory / buffering related signals');
      risks.push('Memory pressure under load');
    }
    if (!reasons.length) {
      reasons.push('No strong performance signals in diff');
    }

    return {
      impact: maxSev(findings.map((f) => f.severity)),
      reasons,
      risks: risks.length ? risks : ['Manual review still recommended for hot paths'],
      affectedAreas: [...new Set(affectedAreas)],
      findings,
    };
  }
}

function mk(
  type: PerformanceFinding['type'],
  title: string,
  severity: PerformanceFinding['severity'],
  recommendation: string,
): PerformanceFinding {
  return {
    id: newId('pf'),
    type,
    title,
    detail: title,
    severity,
    confidence: 0.6,
    recommendation,
    evidence: ['diff heuristics'],
  };
}

function maxSev(
  sevs: PerformanceFinding['severity'][],
): PerformanceFinding['severity'] {
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
  let best: PerformanceFinding['severity'] = 'LOW';
  for (const s of sevs) if (order.indexOf(s) > order.indexOf(best)) best = s;
  return best;
}

export function createPerformanceChangeAnalyzer(): PerformanceChangeAnalyzer {
  return new PerformanceChangeAnalyzer();
}
