import type { AuditLogEntry } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * KnowledgeAuditLog — created / changed / approved / archived.
 * Never stores chat or social activity.
 */
export class KnowledgeAuditLog {
  private entries: AuditLogEntry[] = [];

  load(entries: AuditLogEntry[]): void {
    this.entries = [...entries];
  }

  list(limit = 50): AuditLogEntry[] {
    return [...this.entries]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }

  append(input: {
    action: AuditLogEntry['action'];
    memoryId: string;
    actorId: string;
    detail?: string;
  }): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: newId('audit'),
      at: nowIso(),
      action: input.action,
      memoryId: input.memoryId,
      actorId: input.actorId,
      detail: input.detail,
    };
    this.entries.unshift(entry);
    return entry;
  }
}

export function createKnowledgeAuditLog(): KnowledgeAuditLog {
  return new KnowledgeAuditLog();
}
