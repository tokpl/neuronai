import type { GitChangeMemory } from './types.js';

export interface LinkableKnowledge {
  decisions?: Array<{ id?: string; title: string; keywords?: string[] }>;
  incidents?: Array<{ id?: string; title: string; keywords?: string[] }>;
  docs?: Array<{ id?: string; title: string; keywords?: string[] }>;
}

/**
 * Connect commits to decisions, incidents, documentation.
 */
export class DecisionConnectionLinker {
  link(change: GitChangeMemory, knowledge: LinkableKnowledge): GitChangeMemory {
    const blob = `${change.messageSummary} ${change.modulesAffected.join(' ')} ${change.filesChanged.join(' ')}`.toLowerCase();
    const decisions = matchTitles(blob, knowledge.decisions ?? []);
    const incidents = matchTitles(blob, knowledge.incidents ?? []);
    const docs = matchTitles(blob, knowledge.docs ?? []);

    return {
      ...change,
      relatedDecisions: unique([...(change.relatedDecisions ?? []), ...decisions]),
      relatedIncidents: unique([...(change.relatedIncidents ?? []), ...incidents]),
      relatedDocs: unique([...(change.relatedDocs ?? []), ...docs]),
    };
  }
}

function matchTitles(
  blob: string,
  items: Array<{ id?: string; title: string; keywords?: string[] }>,
): string[] {
  const hits: string[] = [];
  for (const item of items) {
    const keys = [
      ...item.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
      ...(item.keywords ?? []).map((k) => k.toLowerCase()),
    ];
    const score = keys.filter((k) => blob.includes(k)).length;
    if (score >= 1 || blob.includes(item.title.toLowerCase())) {
      hits.push(item.id ? `${item.title} (${item.id})` : item.title);
    }
  }
  return hits.slice(0, 10);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

export function createDecisionConnectionLinker(): DecisionConnectionLinker {
  return new DecisionConnectionLinker();
}
