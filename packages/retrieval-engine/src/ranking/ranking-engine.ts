import type { AnalyzedQuery, RankedHit, RankingWeights, RetrievalHit } from '../types.js';
import { DEFAULT_RANKING_WEIGHTS, clamp01 } from '../types.js';

/**
 * Hybrid ranking: relevance + importance + confidence + distance + freshness + task fit.
 */
export class ContextRankingEngine {
  constructor(private readonly weights: RankingWeights = DEFAULT_RANKING_WEIGHTS) {}

  rank(query: AnalyzedQuery, hits: RetrievalHit[]): RankedHit[] {
    const w = normalizeWeights(this.weights);
    return hits
      .map((hit) => {
        const relevanceScore = clamp01(hit.baseRelevance ?? keywordOverlap(hit, query));
        const importanceScore = clamp01(hit.importance ?? 0.4);
        const confidenceScore = clamp01(hit.confidence ?? 0.5);
        const freshnessScore = temporalFreshness(hit, query);
        const distanceScore = sourceDistance(hit.source);
        const taskRelevance = taskFit(hit, query);

        const finalScore =
          w.relevance * relevanceScore +
          w.importance * importanceScore +
          w.confidence * confidenceScore +
          w.distance * distanceScore +
          w.freshness * freshnessScore +
          w.taskRelevance * taskRelevance;

        return {
          ...hit,
          relevanceScore,
          importanceScore,
          confidenceScore,
          distanceScore,
          freshnessScore,
          finalScore: clamp01(finalScore),
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }
}

function keywordOverlap(hit: RetrievalHit, query: AnalyzedQuery): number {
  const hay = `${hit.title} ${hit.content}`.toLowerCase();
  let n = 0;
  for (const kw of query.keywords) if (hay.includes(kw)) n += 1;
  return clamp01(n / Math.max(3, query.keywords.length));
}

function taskFit(hit: RetrievalHit, query: AnalyzedQuery): number {
  const hay = `${hit.title} ${hit.content}`.toLowerCase();
  let s = 0;
  for (const d of query.domains) if (hay.includes(d)) s += 0.25;
  for (const r of query.related) if (hay.includes(r)) s += 0.15;
  if (query.intent === 'ARCHITECTURE' && hit.source === 'decision') s += 0.3;
  if (query.risk === 'HIGH' && /warn|do not|never|mistake|security/i.test(hay)) s += 0.2;
  return clamp01(s);
}

/** Prefer closer/more authoritative sources slightly */
function sourceDistance(source: RetrievalHit['source']): number {
  const map: Record<RetrievalHit['source'], number> = {
    constitution: 1,
    decision: 0.95,
    memory: 0.85,
    style: 0.8,
    knowledge_graph: 0.75,
    code: 0.7,
    documentation: 0.65,
    git: 0.55,
  };
  return map[source];
}

/**
 * Temporal awareness: newer decisions outrank older ones; outdated stacks demoted.
 */
export function temporalFreshness(hit: RetrievalHit, query: AnalyzedQuery): number {
  const base = clamp01(hit.freshness ?? 0.5);
  const at = hit.updatedAt ?? hit.createdAt;
  if (!at) return base;
  const ageDays = (Date.now() - Date.parse(at)) / 86_400_000;
  if (!Number.isFinite(ageDays)) return base;
  const ageFactor = clamp01(1 - ageDays / 365);
  // Demote clearly superseded tech mentions when query implies current stack
  const content = `${hit.title} ${hit.content}`.toLowerCase();
  if (/mysql|mongodb|rest only/i.test(content) && /postgres|graphql/i.test(query.raw.toLowerCase())) {
    return clamp01(base * 0.4 * ageFactor);
  }
  return clamp01(0.35 * base + 0.65 * ageFactor);
}

function normalizeWeights(w: RankingWeights): RankingWeights {
  const sum =
    w.relevance + w.importance + w.confidence + w.distance + w.freshness + w.taskRelevance;
  if (sum <= 0) return DEFAULT_RANKING_WEIGHTS;
  return {
    relevance: w.relevance / sum,
    importance: w.importance / sum,
    confidence: w.confidence / sum,
    distance: w.distance / sum,
    freshness: w.freshness / sum,
    taskRelevance: w.taskRelevance / sum,
  };
}

export function createContextRankingEngine(
  weights?: Partial<RankingWeights>,
): ContextRankingEngine {
  return new ContextRankingEngine({ ...DEFAULT_RANKING_WEIGHTS, ...weights });
}
