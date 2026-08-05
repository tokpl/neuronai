import type { RankedHit } from '../types.js';

export interface Reranker {
  readonly name: string;
  rerank(hits: RankedHit[], query: string): RankedHit[] | Promise<RankedHit[]>;
}

/** Deterministic local reranker — no external model. */
export class SimpleReranker implements Reranker {
  readonly name = 'simple';
  rerank(hits: RankedHit[], query: string): RankedHit[] {
    const tokens = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);
    return [...hits]
      .map((h) => {
        const hay = `${h.title} ${h.content}`.toLowerCase();
        const bonus = tokens.reduce((s, t) => s + (hay.includes(t) ? 0.02 : 0), 0);
        return { ...h, finalScore: Math.min(1, h.finalScore + bonus) };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }
}

/**
 * Placeholder for future LLM-based reranking (caller injects model).
 * Does not ship or train models — identity pass-through until configured.
 */
export class LLMReranker implements Reranker {
  readonly name = 'llm';
  constructor(private readonly rerankFn?: (hits: RankedHit[], query: string) => Promise<RankedHit[]>) {}
  async rerank(hits: RankedHit[], query: string): Promise<RankedHit[]> {
    if (!this.rerankFn) return hits;
    return this.rerankFn(hits, query);
  }
}

/** Interface stub for cross-encoder backends (onnx / remote API later). */
export class CrossEncoderReranker implements Reranker {
  readonly name = 'cross_encoder';
  constructor(private readonly scoreFn?: (query: string, text: string) => number) {}
  rerank(hits: RankedHit[], query: string): RankedHit[] {
    if (!this.scoreFn) return hits;
    return [...hits]
      .map((h) => ({
        ...h,
        finalScore: Math.min(1, 0.5 * h.finalScore + 0.5 * this.scoreFn!(query, `${h.title}\n${h.content}`)),
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
  }
}

export function createSimpleReranker(): SimpleReranker {
  return new SimpleReranker();
}
