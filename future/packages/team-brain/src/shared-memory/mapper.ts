import type { LocalActor, ScopedMemoryRecord } from '@neuron-ai-memory/team-memory';

import type { MemoryOwnership, SharedMemory, SharedMemoryType, Visibility } from '../types.js';

export function mapTypeToShared(type: string): SharedMemoryType {
  const t = type.toLowerCase();
  if (/security/.test(t)) return 'SECURITY_RULE';
  if (/incident|mistake/.test(t)) return 'INCIDENT';
  if (/pattern/.test(t)) return 'PATTERN';
  if (/doc|knowledge/.test(t)) return 'DOCUMENTATION';
  if (/rule|business/.test(t)) return 'PROJECT_RULE';
  return 'ARCHITECTURE_DECISION';
}

export function mapScopeToVisibility(scope: string): Visibility {
  if (scope === 'PERSONAL') return 'personal';
  if (scope === 'TEAM' || scope === 'ORGANIZATION') return 'team';
  return 'project';
}

export function mapStatus(status: string): SharedMemory['status'] {
  switch (status) {
    case 'draft':
      return 'DRAFT';
    case 'proposed':
    case 'pending_review':
      return 'REVIEW';
    case 'approved':
    case 'active':
      return 'APPROVED';
    case 'archived':
    case 'rejected':
      return 'ARCHIVED';
    default:
      return 'DRAFT';
  }
}

export function toSharedMemory(record: ScopedMemoryRecord, contributors: string[] = []): SharedMemory {
  const ownership: MemoryOwnership = {
    creator: record.createdBy,
    contributors: [...new Set([record.createdBy, ...contributors, record.updatedBy].filter(Boolean))],
    source: 'team-memory',
    approvedBy: record.approvedBy,
  };
  return {
    id: record.id,
    type: mapTypeToShared(record.type),
    title: record.title,
    content: record.content,
    owner: record.ownerId,
    contributors: ownership.contributors,
    visibility: mapScopeToVisibility(record.scope),
    confidence: record.status === 'active' || record.status === 'approved' ? 0.85 : 0.5,
    status: mapStatus(record.status),
    ownership,
    history: [
      {
        at: record.createdAt,
        actorId: record.createdBy,
        action: 'created',
      },
      ...(record.approvedBy
        ? [{ at: record.updatedAt, actorId: record.approvedBy, action: 'approved' }]
        : []),
    ],
    projectId: record.projectId,
    teamId: record.teamId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function memberDisplay(actors: LocalActor[], id: string): string {
  return actors.find((a) => a.id === id)?.displayName ?? id;
}
