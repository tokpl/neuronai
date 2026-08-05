import type { SecurityAuditEntry } from '@neuron-ai-memory/security-core';

import type { UnifiedAuditEntry } from '../types.js';
import { newId, nowIso } from '../types.js';

/** Team audit entry shape (compatible with team-brain KnowledgeAuditLog). */
export interface TeamAuditLogEntry {
  id: string;
  at: string;
  action: string;
  actorId: string;
  memoryId?: string;
  detail?: string;
}

/**
 * Merge SecurityAuditLog + TeamAuditLog into who/what/when/where.
 */
export class UnifiedWorkspaceAudit {
  private entries: UnifiedAuditEntry[] = [];
  private max = 500;

  load(entries: UnifiedAuditEntry[]): void {
    this.entries = [...entries];
  }

  list(limit = 50): UnifiedAuditEntry[] {
    return this.entries.slice(0, limit);
  }

  record(input: {
    who: string;
    what: string;
    where?: UnifiedAuditEntry['where'];
    source?: UnifiedAuditEntry['source'];
    details?: Record<string, unknown>;
  }): UnifiedAuditEntry {
    const entry: UnifiedAuditEntry = {
      id: newId('waud'),
      who: input.who,
      what: input.what,
      when: nowIso(),
      where: input.where ?? {},
      source: input.source ?? 'workspace',
      details: input.details,
    };
    this.entries.unshift(entry);
    this.entries = this.entries.slice(0, this.max);
    return entry;
  }

  ingestSecurity(
    entries: SecurityAuditEntry[],
    where?: UnifiedAuditEntry['where'],
  ): void {
    for (const e of entries) {
      this.record({
        who: 'security-core',
        what: `${e.type}: ${e.summary}`,
        where,
        source: 'security',
        details: { auditId: e.id },
      });
    }
  }

  ingestTeam(entries: TeamAuditLogEntry[], where?: UnifiedAuditEntry['where']): void {
    for (const e of entries) {
      this.record({
        who: e.actorId,
        what: `${e.action}${e.memoryId ? ` @ ${e.memoryId}` : ''}${e.detail ? ` — ${e.detail}` : ''}`,
        where,
        source: 'team',
        details: { auditId: e.id },
      });
    }
  }

  snapshot(): UnifiedAuditEntry[] {
    return [...this.entries];
  }
}

export function createUnifiedWorkspaceAudit(): UnifiedWorkspaceAudit {
  return new UnifiedWorkspaceAudit();
}
