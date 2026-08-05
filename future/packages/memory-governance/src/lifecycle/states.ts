import type { MemoryLifecycleState } from '../types.js';

export const LIFECYCLE_FLOW: MemoryLifecycleState[] = [
  'PROPOSED',
  'ACTIVE',
  'VALIDATED',
  'OUTDATED',
  'CONFLICTED',
  'ARCHIVED',
];

export function describeLifecycle(state: MemoryLifecycleState): string {
  switch (state) {
    case 'PROPOSED':
      return 'Newly stored / suggested — not yet confirmed.';
    case 'ACTIVE':
      return 'Current project truth in active use.';
    case 'VALIDATED':
      return 'Confirmed by code, tests, git, or developer approval.';
    case 'OUTDATED':
      return 'Likely stale vs code or age/usage — still kept, needs review.';
    case 'CONFLICTED':
      return 'Conflicts with another memory — requires resolution.';
    case 'ARCHIVED':
      return 'Historical — not treated as current truth; never deleted.';
  }
}

/** MemoryLifecycle helper — status transitions are proposals only. */
export class MemoryLifecycle {
  describe = describeLifecycle;
  flow = LIFECYCLE_FLOW;

  canTransition(from: MemoryLifecycleState, to: MemoryLifecycleState): boolean {
    if (from === to) return true;
    if (to === 'ARCHIVED') return from !== 'ARCHIVED'; // archive from any non-archived
    if (from === 'ARCHIVED') return false; // un-archive is explicit restore elsewhere
    if (to === 'CONFLICTED') return true;
    if (to === 'OUTDATED') return from === 'ACTIVE' || from === 'VALIDATED' || from === 'PROPOSED';
    if (to === 'VALIDATED') return from === 'PROPOSED' || from === 'ACTIVE' || from === 'OUTDATED';
    if (to === 'ACTIVE') return from === 'PROPOSED' || from === 'VALIDATED' || from === 'OUTDATED';
    if (to === 'PROPOSED') return false;
    return false;
  }
}

export function createMemoryLifecycle(): MemoryLifecycle {
  return new MemoryLifecycle();
}
