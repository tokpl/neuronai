import type { GovernanceAuditEntry } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Append-only audit log for governance proposals / approved actions.
 * No hidden knowledge changes.
 */
export class GovernanceAuditLog {
  private entries: GovernanceAuditEntry[] = [];

  load(entries: GovernanceAuditEntry[]): void {
    this.entries = [...entries];
  }

  list(limit = 100): GovernanceAuditEntry[] {
    return [...this.entries].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  append(input: {
    action: string;
    memoryIds: string[];
    detail: string;
    actor?: string;
  }): GovernanceAuditEntry {
    const entry: GovernanceAuditEntry = {
      id: newId('gaudit'),
      at: nowIso(),
      action: input.action,
      memoryIds: input.memoryIds,
      detail: input.detail,
      actor: input.actor ?? 'local-developer',
    };
    this.entries.unshift(entry);
    return entry;
  }
}

export function createGovernanceAuditLog(): GovernanceAuditLog {
  return new GovernanceAuditLog();
}
