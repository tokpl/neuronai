import type { TechnicalTaskMemory, TaskStatus } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Technical task context — not a Jira replacement, not people tracking.
 */
export class TaskMemoryStore {
  private tasks: TechnicalTaskMemory[] = [];

  load(tasks: TechnicalTaskMemory[]): void {
    this.tasks = [...tasks];
  }

  list(): TechnicalTaskMemory[] {
    return [...this.tasks];
  }

  get(id: string): TechnicalTaskMemory | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  upsert(input: {
    id?: string;
    title: string;
    status?: TaskStatus;
    percentComplete?: number;
    completed?: string[];
    remaining?: string[];
    relatedDecisions?: string[];
    relatedFiles?: string[];
    risks?: string[];
  }): TechnicalTaskMemory {
    const now = nowIso();
    if (input.id) {
      const existing = this.get(input.id);
      if (existing) {
        existing.title = input.title;
        if (input.status) existing.status = input.status;
        if (input.percentComplete !== undefined) existing.percentComplete = clampPct(input.percentComplete);
        if (input.completed) existing.completed = input.completed;
        if (input.remaining) existing.remaining = input.remaining;
        if (input.relatedDecisions) existing.relatedDecisions = input.relatedDecisions;
        if (input.relatedFiles) existing.relatedFiles = input.relatedFiles;
        if (input.risks) existing.risks = input.risks;
        existing.updatedAt = now;
        return existing;
      }
    }

    const completed = input.completed ?? [];
    const remaining = input.remaining ?? [];
    const pct =
      input.percentComplete ??
      (completed.length + remaining.length === 0
        ? 0
        : Math.round((completed.length / (completed.length + remaining.length)) * 100));

    const task: TechnicalTaskMemory = {
      id: input.id ?? newId('task'),
      title: input.title,
      status: input.status ?? 'IN_PROGRESS',
      percentComplete: clampPct(pct),
      completed,
      remaining,
      relatedDecisions: input.relatedDecisions ?? [],
      relatedFiles: input.relatedFiles ?? [],
      risks: input.risks ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.unshift(task);
    return task;
  }

  search(query: string): TechnicalTaskMemory[] {
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    return this.tasks.filter((t) => {
      const hay = `${t.title} ${t.completed.join(' ')} ${t.remaining.join(' ')} ${t.relatedDecisions.join(' ')}`.toLowerCase();
      return tokens.some((tok) => hay.includes(tok));
    });
  }
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function createTaskMemoryStore(): TaskMemoryStore {
  return new TaskMemoryStore();
}
