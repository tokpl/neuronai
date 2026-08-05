import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { GovernancePolicy } from '../types.js';
import { daysSince } from '../types.js';

export const DEFAULT_GOVERNANCE_POLICIES: GovernancePolicy[] = [
  {
    id: 'arch-90d',
    name: 'Architecture decision review',
    description: 'Architecture decisions should be reviewed every 90 days',
    match: { types: ['architecture_decision'] },
    reviewEveryDays: 90,
    neverAutoArchive: false,
    whySuggested: 'Why: architecture choices drift; periodic human validation keeps the brain honest.',
  },
  {
    id: 'workaround-30d',
    name: 'Temporary workaround review',
    description: 'Workarounds / temporary fixes review every 30 days',
    match: { tagsAny: ['workaround', 'temporary', 'hotfix'], titleIncludes: ['workaround', 'temporary', 'todo'] },
    reviewEveryDays: 30,
    neverAutoArchive: false,
    whySuggested: 'Why: temporary fixes tend to become permanent debt without review.',
  },
  {
    id: 'security-never-archive',
    name: 'Critical security rules',
    description: 'Security / auth rules must never be auto-archived',
    match: {
      types: ['business_rule', 'mistake'],
      tagsAny: ['security', 'auth', 'critical'],
      titleIncludes: ['security', 'auth', 'permission', 'rbac'],
    },
    reviewEveryDays: 180,
    neverAutoArchive: true,
    whySuggested: 'Why: security knowledge is high blast-radius — only humans archive it.',
  },
  {
    id: 'pattern-120d',
    name: 'Coding pattern freshness',
    description: 'Patterns reviewed every 120 days',
    match: { types: ['pattern'] },
    reviewEveryDays: 120,
    neverAutoArchive: false,
    whySuggested: 'Why: preferred libraries and styles change; stale patterns mislead agents.',
  },
];

export class GovernancePolicyEngine {
  constructor(private readonly policies: GovernancePolicy[] = DEFAULT_GOVERNANCE_POLICIES) {}

  matching(memory: MemoryRecord): GovernancePolicy[] {
    return this.policies.filter((p) => matches(memory, p));
  }

  dueForReview(memory: MemoryRecord, now = new Date()): GovernancePolicy[] {
    return this.matching(memory).filter((p) => {
      if (p.reviewEveryDays == null) return false;
      const age = daysSince(memory.updatedAt, now);
      return age >= p.reviewEveryDays;
    });
  }

  allowsArchiveSuggestion(memory: MemoryRecord): boolean {
    return !this.matching(memory).some((p) => p.neverAutoArchive);
  }

  list(): GovernancePolicy[] {
    return [...this.policies];
  }
}

function matches(m: MemoryRecord, p: GovernancePolicy): boolean {
  const { types, tagsAny, titleIncludes } = p.match;
  let hit = false;
  if (types?.length) {
    if (types.includes(m.type)) hit = true;
    else if (!tagsAny?.length && !titleIncludes?.length) return false;
  }
  if (tagsAny?.length) {
    const tags = m.tags.map((t) => t.toLowerCase());
    if (tagsAny.some((t) => tags.includes(t.toLowerCase()))) hit = true;
  }
  if (titleIncludes?.length) {
    const hay = `${m.title} ${m.content}`.toLowerCase();
    if (titleIncludes.some((t) => hay.includes(t.toLowerCase()))) hit = true;
  }
  if (!types?.length && !tagsAny?.length && !titleIncludes?.length) return true;
  return hit;
}

export function createGovernancePolicyEngine(
  policies?: GovernancePolicy[],
): GovernancePolicyEngine {
  return new GovernancePolicyEngine(policies);
}
