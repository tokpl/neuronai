import type { ModelPerformanceRecord, TaskProfileKind } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Remembers model × task quality / latency / cost for better routing over time.
 * Never stores prompts or API keys.
 */
export class ModelPerformanceMemory {
  private records: ModelPerformanceRecord[] = [];

  load(records: ModelPerformanceRecord[]): void {
    this.records = [...records];
  }

  list(): ModelPerformanceRecord[] {
    return [...this.records];
  }

  record(input: {
    model: string;
    provider: string;
    task: TaskProfileKind | string;
    quality: number;
    latencyMs: number;
    costEstimate?: number;
  }): ModelPerformanceRecord {
    const existing = this.records.find(
      (r) =>
        r.model === input.model &&
        r.provider === input.provider &&
        r.task === input.task,
    );
    if (existing) {
      const n = existing.samples + 1;
      existing.quality = (existing.quality * existing.samples + input.quality) / n;
      existing.latencyMs =
        (existing.latencyMs * existing.samples + input.latencyMs) / n;
      existing.costEstimate =
        (existing.costEstimate * existing.samples + (input.costEstimate ?? 0)) / n;
      existing.samples = n;
      existing.updatedAt = nowIso();
      return existing;
    }
    const row: ModelPerformanceRecord = {
      id: newId('perf'),
      model: input.model,
      provider: input.provider,
      task: input.task,
      quality: input.quality,
      latencyMs: input.latencyMs,
      costEstimate: input.costEstimate ?? 0,
      samples: 1,
      updatedAt: nowIso(),
    };
    this.records.unshift(row);
    return row;
  }

  bestForTask(task: TaskProfileKind | string): ModelPerformanceRecord | undefined {
    return this.list()
      .filter((r) => r.task === task)
      .sort((a, b) => b.quality - a.quality || a.latencyMs - b.latencyMs)[0];
  }
}

export function createModelPerformanceMemory(): ModelPerformanceMemory {
  return new ModelPerformanceMemory();
}
