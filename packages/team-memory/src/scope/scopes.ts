import type { MemoryScope } from '../types.js';

export const MEMORY_SCOPES: MemoryScope[] = ['PERSONAL', 'PROJECT', 'TEAM', 'ORGANIZATION'];

export function describeScope(scope: MemoryScope): string {
  switch (scope) {
    case 'PERSONAL':
      return 'Private developer notes — not shared as project truth.';
    case 'PROJECT':
      return 'Shared project engineering knowledge visible to the repo team.';
    case 'TEAM':
      return 'Cross-project team conventions and playbooks.';
    case 'ORGANIZATION':
      return 'Company-wide knowledge (architecture reserved; local stub only).';
  }
}

export function defaultScopeForDecision(): MemoryScope {
  return 'PROJECT';
}

export function parseScope(raw: string | undefined, fallback: MemoryScope = 'PROJECT'): MemoryScope {
  const u = (raw ?? '').toUpperCase();
  if (u === 'PERSONAL' || u === 'PROJECT' || u === 'TEAM' || u === 'ORGANIZATION') return u;
  return fallback;
}
