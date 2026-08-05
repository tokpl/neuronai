/**
 * Link architecture transitions into knowledge-graph friendly records.
 * Does not host git - only evolution edges for the project brain.
 */

export interface EvolutionTransitionInput {
  memoryTitle: string;
  before: string;
  after: string;
  commit?: string;
  relatedDecisions?: string[];
}

export interface EvolutionGraphLink {
  nodeHint: {
    type: 'ARCHITECTURE_TRANSITION';
    title: string;
    before: string;
    after: string;
    commit?: string;
  };
  edgeHints: Array<{
    relation: 'EVOLVED_FROM' | 'RELATED_DECISION' | 'INTRODUCED_IN_COMMIT';
    target: string;
  }>;
}

export class GitEvolutionLinker {
  toGraphLinks(transitions: EvolutionTransitionInput[]): EvolutionGraphLink[] {
    return transitions.map((t) => ({
      nodeHint: {
        type: 'ARCHITECTURE_TRANSITION',
        title: t.memoryTitle,
        before: t.before,
        after: t.after,
        commit: t.commit,
      },
      edgeHints: [
        { relation: 'EVOLVED_FROM', target: t.before },
        ...(t.commit
          ? [{ relation: 'INTRODUCED_IN_COMMIT' as const, target: t.commit }]
          : []),
        ...(t.relatedDecisions ?? []).map((d) => ({
          relation: 'RELATED_DECISION' as const,
          target: d,
        })),
      ],
    }));
  }

  describeTransition(t: EvolutionTransitionInput): string {
    return (
      `Architecture evolution: ${t.before} → ${t.after}` +
      (t.commit ? ` (commit ${t.commit})` : '')
    );
  }
}

export function createGitEvolutionLinker(): GitEvolutionLinker {
  return new GitEvolutionLinker();
}
