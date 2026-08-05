import type { AuditAction, MemoryAuditEntry, MemoryScope, TeamDocument } from '../types.js';
import { newId, nowIso } from '../types.js';

export class MemoryAuditLog {
  append(
    doc: TeamDocument,
    input: {
      memoryId: string;
      actorId: string;
      action: AuditAction;
      scope: MemoryScope;
      detail?: string;
    },
  ): TeamDocument {
    const entry: MemoryAuditEntry = {
      id: newId('audit'),
      memoryId: input.memoryId,
      projectId: doc.projectId,
      actorId: input.actorId,
      action: input.action,
      scope: input.scope,
      detail: input.detail,
      at: nowIso(),
    };
    return {
      ...doc,
      audit: [...doc.audit, entry].slice(-5_000),
      updatedAt: nowIso(),
    };
  }

  forMemory(doc: TeamDocument, memoryId: string): MemoryAuditEntry[] {
    return doc.audit.filter((a) => a.memoryId === memoryId);
  }

  recent(doc: TeamDocument, limit = 50): MemoryAuditEntry[] {
    return doc.audit.slice(-limit).reverse();
  }
}

export function createMemoryAuditLog(): MemoryAuditLog {
  return new MemoryAuditLog();
}
