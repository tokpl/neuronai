import type { BenchmarkCompareSnapshot, OptimizationRecord } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Lightweight before/after snapshots for Benchmark Suite pairing.
 * Does not run APM or production monitoring.
 */
export class BenchmarkBridge {
  private snapshots: BenchmarkCompareSnapshot[] = [];

  load(snaps: BenchmarkCompareSnapshot[]): void {
    this.snapshots = [...snaps];
  }

  list(): BenchmarkCompareSnapshot[] {
    return [...this.snapshots];
  }

  recordBefore(label: string, metrics: Record<string, number | string>, notes: string[] = []): BenchmarkCompareSnapshot {
    return this.push('before', label, metrics, notes);
  }

  recordAfter(label: string, metrics: Record<string, number | string>, notes: string[] = []): BenchmarkCompareSnapshot {
    return this.push('after', label, metrics, notes);
  }

  compare(label: string): {
    before?: BenchmarkCompareSnapshot;
    after?: BenchmarkCompareSnapshot;
    deltas: Array<{ key: string; before: string | number; after: string | number }>;
    summary: string;
  } {
    const before = [...this.snapshots].reverse().find((s) => s.label === label && s.phase === 'before');
    const after = [...this.snapshots].reverse().find((s) => s.label === label && s.phase === 'after');
    const deltas: Array<{ key: string; before: string | number; after: string | number }> = [];
    if (before && after) {
      for (const key of new Set([...Object.keys(before.metrics), ...Object.keys(after.metrics)])) {
        deltas.push({
          key,
          before: before.metrics[key] ?? 'n/a',
          after: after.metrics[key] ?? 'n/a',
        });
      }
    }
    return {
      before,
      after,
      deltas,
      summary:
        before && after
          ? `Compared "${label}" before→after (${deltas.length} metrics). Wire to Benchmark Suite for full WITH/WITHOUT Neuron runs.`
          : `Incomplete pair for "${label}" — record before and after optimization.`,
    };
  }

  fromOptimization(opt: OptimizationRecord): BenchmarkCompareSnapshot[] {
    const before = this.recordBefore(opt.problem, {
      note: opt.beforeMetric ?? 'baseline',
    }, [opt.problem]);
    const after = this.recordAfter(opt.problem, {
      note: opt.afterMetric ?? opt.result,
    }, [opt.solution, opt.result]);
    return [before, after];
  }

  private push(
    phase: 'before' | 'after',
    label: string,
    metrics: Record<string, number | string>,
    notes: string[],
  ): BenchmarkCompareSnapshot {
    const snap: BenchmarkCompareSnapshot = {
      id: newId('bench'),
      label,
      phase,
      notes,
      metrics,
      createdAt: nowIso(),
    };
    this.snapshots.unshift(snap);
    return snap;
  }
}

export function createBenchmarkBridge(): BenchmarkBridge {
  return new BenchmarkBridge();
}
