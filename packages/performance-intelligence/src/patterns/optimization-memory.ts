import type { OptimizationRecord } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Remember applied optimizations (knowledge — not auto-deploy).
 */
export class OptimizationMemory {
  private records: OptimizationRecord[] = [];

  load(records: OptimizationRecord[]): void {
    this.records = [...records];
  }

  list(): OptimizationRecord[] {
    return [...this.records];
  }

  remember(input: {
    problem: string;
    solution: string;
    result: string;
    module?: string;
    beforeMetric?: string;
    afterMetric?: string;
  }): OptimizationRecord {
    const rec: OptimizationRecord = {
      id: newId('opt'),
      problem: input.problem,
      solution: input.solution,
      result: input.result,
      module: input.module,
      beforeMetric: input.beforeMetric,
      afterMetric: input.afterMetric,
      createdAt: nowIso(),
    };
    this.records.unshift(rec);
    return rec;
  }

  search(query: string): OptimizationRecord[] {
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    return this.records.filter((r) => {
      const hay = `${r.problem} ${r.solution} ${r.result} ${r.module ?? ''}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
  }
}

export function createOptimizationMemory(): OptimizationMemory {
  return new OptimizationMemory();
}
