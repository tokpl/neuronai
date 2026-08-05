import type { ModelEvalRow } from '../types.js';
import { round2 } from '../types.js';

/**
 * ModelEvaluator — compare providers on task scores (architecture reasoning, etc.).
 * Uses recorded performance samples — does not train models.
 */
export class ModelEvaluator {
  private rows: ModelEvalRow[] = [];

  load(rows: ModelEvalRow[]): void {
    this.rows = [...rows];
  }

  list(): ModelEvalRow[] {
    return [...this.rows];
  }

  record(input: {
    provider: string;
    model: string;
    task: string;
    score: number;
    latencyMs?: number;
  }): ModelEvalRow {
    const existing = this.rows.find(
      (r) =>
        r.provider === input.provider &&
        r.model === input.model &&
        r.task === input.task,
    );
    if (existing) {
      const n = existing.samples + 1;
      existing.score = round2((existing.score * existing.samples + input.score) / n);
      if (input.latencyMs !== undefined) {
        existing.latencyMs = Math.round(
          ((existing.latencyMs ?? input.latencyMs) * existing.samples + input.latencyMs) / n,
        );
      }
      existing.samples = n;
      return existing;
    }
    const row: ModelEvalRow = {
      provider: input.provider,
      model: input.model,
      task: input.task,
      score: round2(input.score),
      latencyMs: input.latencyMs,
      samples: 1,
    };
    this.rows.push(row);
    return row;
  }

  compare(task: string): ModelEvalRow[] {
    return this.list()
      .filter((r) => r.task === task)
      .sort((a, b) => b.score - a.score);
  }

  markdown(task: string): string {
    const rows = this.compare(task);
    if (!rows.length) return `No model samples for task ${task}.`;
    return [
      `Model comparison — ${task}`,
      ...rows.map(
        (r) =>
          `- ${r.provider}/${r.model}: ${(r.score * 100).toFixed(0)}%` +
          (r.latencyMs !== undefined ? ` (${r.latencyMs}ms)` : ''),
      ),
    ].join('\n');
  }
}

export function createModelEvaluator(): ModelEvaluator {
  return new ModelEvaluator();
}
