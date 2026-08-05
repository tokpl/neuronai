import type { DebtPriority, TechnicalDebtItem } from '../types.js';
import { newId, nowIso } from '../types.js';

export class TechnicalDebtMemory {
  private items: TechnicalDebtItem[] = [];

  load(items: TechnicalDebtItem[]): void {
    this.items = [...items];
  }

  list(): TechnicalDebtItem[] {
    return [...this.items];
  }

  record(input: {
    issue: string;
    impact: string;
    location: string;
    priority: DebtPriority;
    note?: string;
  }): TechnicalDebtItem {
    const existing = this.items.find(
      (i) => i.location === input.location && i.issue === input.issue,
    );
    if (existing) {
      existing.history.unshift({
        at: nowIso(),
        note: input.note ?? 'Reconfirmed',
      });
      existing.priority = input.priority;
      existing.impact = input.impact;
      return existing;
    }
    const item: TechnicalDebtItem = {
      id: newId('debt'),
      issue: input.issue,
      impact: input.impact,
      location: input.location,
      priority: input.priority,
      history: [{ at: nowIso(), note: input.note ?? 'Detected' }],
    };
    this.items.unshift(item);
    this.items = this.items.slice(0, 200);
    return item;
  }

  snapshot(): TechnicalDebtItem[] {
    return [...this.items];
  }
}

export function createTechnicalDebtMemory(): TechnicalDebtMemory {
  return new TechnicalDebtMemory();
}
