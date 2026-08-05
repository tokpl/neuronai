import type { GitChangeMemory, KnowledgeOrigin } from './types.js';

/**
 * Blame intelligence — where knowledge originated, never "who is guilty".
 */
export class BlameIntelligence {
  origin(input: {
    topic: string;
    changes: GitChangeMemory[];
    pathHint?: string;
  }): KnowledgeOrigin {
    const topic = input.topic.toLowerCase();
    const ranked = [...input.changes].sort((a, b) => a.date.localeCompare(b.date));

    const hit =
      ranked.find((c) => {
        const blob = `${c.messageSummary} ${c.filesChanged.join(' ')}`.toLowerCase();
        return (
          blob.includes(topic) ||
          (input.pathHint
            ? c.filesChanged.some((f) =>
                f.toLowerCase().includes(input.pathHint!.toLowerCase()),
              )
            : false)
        );
      }) ?? ranked[0];

    return {
      topic: input.topic,
      introducedInCommit: hit?.commit,
      relatedDecision: hit?.relatedDecisions[0],
      relatedFiles: hit?.filesChanged.slice(0, 8) ?? [],
      note: hit
        ? `Knowledge about "${input.topic}" appears around commit ${hit.commit}` +
          (hit.relatedDecisions[0] ? ` — related decision: ${hit.relatedDecisions[0]}` : '') +
          '. Not a people blame report.'
        : `No git-derived origin found for "${input.topic}" yet.`,
    };
  }
}

export function createBlameIntelligence(): BlameIntelligence {
  return new BlameIntelligence();
}
