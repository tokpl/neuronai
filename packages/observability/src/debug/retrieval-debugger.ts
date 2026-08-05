import { filterTraceText } from '../tracing/filters.js';
import type { RetrievalDebugSnapshot } from '../tracing/types.js';

export interface RetrievalDebuggerInput {
  query: string;
  candidates: Array<{ title: string; score: number }>;
  selected: string[];
}

export class RetrievalDebugger {
  snapshot(input: RetrievalDebuggerInput): RetrievalDebugSnapshot {
    const ranking = [...input.candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((c) => ({
        title: filterTraceText(c.title, 120),
        score: Math.round(c.score * 1000) / 1000,
      }));

    return {
      query: filterTraceText(input.query, 300),
      candidateCount: input.candidates.length,
      selectedCount: input.selected.length,
      ranking,
      selected: input.selected.map((s) => filterTraceText(s, 120)).slice(0, 40),
    };
  }

  format(snap: RetrievalDebugSnapshot): string {
    return [
      `Query: ${snap.query}`,
      '',
      `Found:`,
      `${snap.candidateCount} memories`,
      '',
      `Selected:`,
      `${snap.selectedCount}`,
      '',
      'Ranking (top):',
      ...snap.ranking.slice(0, 10).map((r) => `- ${r.title} (${r.score})`),
      '',
      'Selected context:',
      ...snap.selected.map((s) => `- ${s}`),
    ].join('\n');
  }
}

export function createRetrievalDebugger(): RetrievalDebugger {
  return new RetrievalDebugger();
}
