import type { ArchitectureTransition, GitChangeMemory } from './types.js';
import { newId, nowIso } from './types.js';

const TRANSITION_PATTERNS: Array<{
  test: RegExp;
  before: string;
  after: string;
}> = [
  { test: /rest\s*(api)?\s*.*\s*graphql|replace\s+rest\s+with\s+graphql|migrate\s+to\s+graphql/i, before: 'REST API', after: 'GraphQL' },
  { test: /graphql\s*.*\s*rest|back\s+to\s+rest/i, before: 'GraphQL', after: 'REST API' },
  { test: /mongo(db)?\s*.*\s*postgres|migrate\s+to\s+postgres/i, before: 'MongoDB', after: 'PostgreSQL' },
  { test: /redis\s+cache|remove\s+caching\s+layer|replace\s+redis/i, before: 'Redis cache', after: 'no dedicated cache / alternative' },
  { test: /monolith\s*.*\s*microservice|extract\s+service/i, before: 'Monolith', after: 'Service extraction' },
  { test: /session\s*.*\s*jwt|migrate\s+to\s+jwt/i, before: 'Session auth', after: 'JWT' },
];

/**
 * Detect architecture transitions from commits → transition memory.
 */
export class ArchitectureEvolutionTracker {
  private transitions: ArchitectureTransition[] = [];

  load(items: ArchitectureTransition[]): void {
    this.transitions = [...items];
  }

  list(): ArchitectureTransition[] {
    return [...this.transitions];
  }

  observe(change: GitChangeMemory): ArchitectureTransition | undefined {
    if (change.changeType !== 'ARCHITECTURE' && change.changeType !== 'PERFORMANCE') {
      // still allow message-based detection
    }
    const blob = `${change.messageSummary} ${change.filesChanged.join(' ')}`;
    for (const p of TRANSITION_PATTERNS) {
      if (!p.test.test(blob)) continue;
      const t: ArchitectureTransition = {
        id: newId('aev'),
        before: p.before,
        after: p.after,
        commit: change.commit,
        date: change.date,
        relatedDecisions: change.relatedDecisions,
        memoryTitle: `Architecture transition: ${p.before} → ${p.after}`,
        summary: `Before: ${p.before}. After: ${p.after}. Commit ${change.commit}.`,
      };
      this.transitions.unshift(t);
      this.transitions = this.transitions.slice(0, 100);
      return t;
    }
    return undefined;
  }

  recordManual(input: {
    before: string;
    after: string;
    commit?: string;
    relatedDecisions?: string[];
  }): ArchitectureTransition {
    const t: ArchitectureTransition = {
      id: newId('aev'),
      before: input.before.slice(0, 120),
      after: input.after.slice(0, 120),
      commit: input.commit,
      date: nowIso(),
      relatedDecisions: input.relatedDecisions ?? [],
      memoryTitle: `Architecture transition: ${input.before} → ${input.after}`,
      summary: `Before: ${input.before}. After: ${input.after}.`,
    };
    this.transitions.unshift(t);
    return t;
  }
}

export function createArchitectureEvolutionTracker(): ArchitectureEvolutionTracker {
  return new ArchitectureEvolutionTracker();
}
