import { createContextCompressor } from '../compression/compressor.js';
import { createContextAssembler } from '../context/assembler.js';
import { createContextBudgetManager } from '../context/budget.js';
import { createRetrievalCache, RetrievalCache } from '../context/cache.js';
import { createMemoryClusterer } from '../context/clusterer.js';
import { createConflictAwareFilter } from '../context/conflicts.js';
import {
  createRetrievalLearningLoop,
  type RetrievalFeedback,
} from '../evaluation/learning-loop.js';
import { createRetrievalEvaluator } from '../evaluation/evaluator.js';
import { createQueryAnalyzer } from '../query/query-analyzer.js';
import { createContextRankingEngine } from '../ranking/ranking-engine.js';
import { createSimpleReranker, type Reranker } from '../ranking/reranker.js';
import { defaultRetrievers, type Retriever } from '../retrievers/index.js';
import type { RankingWeights, RetrievalInput } from '../types.js';
import { DEFAULT_RANKING_WEIGHTS } from '../types.js';

export interface RetrievalResult {
  query: ReturnType<ReturnType<typeof createQueryAnalyzer>['analyze']>;
  context: ReturnType<ReturnType<typeof createContextAssembler>['assemble']>;
  budget: ReturnType<ReturnType<typeof createContextBudgetManager>['plan']>;
  metrics: ReturnType<ReturnType<typeof createRetrievalEvaluator>['evaluate']>;
  compression: { savedTokens: number; techniques: string[] };
  cacheHit: boolean;
}

/**
 * Full pipeline:
 * Task → Query Understanding → Multi Source Retrieval → Ranking → Filtering
 * → Compression → Context Assembly → Agent Context
 */
export class RetrievalEngine {
  private readonly analyzer = createQueryAnalyzer();
  private readonly budgetMgr = createContextBudgetManager();
  private readonly compressor = createContextCompressor();
  private readonly clusterer = createMemoryClusterer();
  private readonly conflicts = createConflictAwareFilter();
  private readonly assembler = createContextAssembler();
  private readonly evaluator = createRetrievalEvaluator();
  private readonly learning = createRetrievalLearningLoop();
  private readonly cache: RetrievalCache;
  private rankingWeights: RankingWeights;

  constructor(
    private readonly retrievers: Retriever[] = defaultRetrievers(),
    private readonly reranker: Reranker = createSimpleReranker(),
    options: { cacheTtlMs?: number; rankingWeights?: Partial<RankingWeights> } = {},
  ) {
    this.cache = createRetrievalCache(options.cacheTtlMs);
    this.rankingWeights = { ...DEFAULT_RANKING_WEIGHTS, ...options.rankingWeights };
  }

  async retrieve(input: RetrievalInput): Promise<RetrievalResult> {
    const version = `${input.memories.length}:${(input.constitutionRules ?? []).length}`;
    const cacheKey = RetrievalCache.cacheKey(input.task, version);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const query = this.analyzer.analyze(input.task);
      const budget = this.budgetMgr.plan(query.complexity, {
        availableTokens: input.availableTokens,
        agentMode: input.agentMode,
      });
      return {
        query,
        context: cached,
        budget,
        metrics: this.evaluator.evaluate({
          selected: cached.selected,
          allCandidateCount: cached.selected.length + cached.omitted,
          tokenEstimate: cached.tokenEstimate,
          tokenBudget: budget.maxTokens,
          context: cached,
        }),
        compression: { savedTokens: 0, techniques: ['cache'] },
        cacheHit: true,
      };
    }

    const query = this.analyzer.analyze(input.task);
    const budget = this.budgetMgr.plan(query.complexity, {
      availableTokens: input.availableTokens,
      agentMode: input.agentMode,
    });

    const retrievalCtx = {
      memories: input.memories,
      constitutionRules: input.constitutionRules,
      fileNames: input.fileNames,
      graphModules: input.graphModules,
      gitSubjects: input.gitSubjects,
      docSnippets: input.docSnippets,
    };

    const rawHits = this.retrievers.flatMap((r) => r.retrieve(query, retrievalCtx));
    const ranker = createContextRankingEngine({
      ...this.rankingWeights,
      ...input.rankingWeights,
    });
    let ranked = ranker.rank(query, rawHits);
    ranked = await Promise.resolve(this.reranker.rerank(ranked, input.task));

    const { conflicts, filtered } = this.conflicts.detect(ranked);
    const compressed = this.compressor.compress(
      filtered,
      budget.maxTokens,
      budget.snippetChars,
    );
    const limited = compressed.hits.slice(0, budget.maxItems);
    const omitted = Math.max(0, filtered.length - limited.length);
    const clusters = this.clusterer.cluster(limited);

    const explanation = [
      `Intent=${query.intent} risk=${query.risk} domains=${query.domains.join(',')}`,
      `Retrieved ${rawHits.length} hits from ${this.retrievers.length} sources`,
      `Ranked with hybrid weights; reranker=${this.reranker.name}`,
      conflicts.length ? `Detected ${conflicts.length} architecture conflict(s)` : 'No conflicts',
      `Budget ${budget.complexity}: ≤${budget.maxTokens} tokens / ≤${budget.maxItems} items`,
      `Compression: ${compressed.techniques.join(', ') || 'none'} (saved ~${compressed.savedTokens} tokens)`,
      ...limited.slice(0, 5).map(
        (h, i) =>
          `#${i + 1} [${h.finalScore.toFixed(2)}] ${h.source}/${h.title} (rel=${h.relevanceScore.toFixed(2)} imp=${h.importanceScore.toFixed(2)} fresh=${h.freshnessScore.toFixed(2)})`,
      ),
    ];

    const context = this.assembler.assemble({
      query,
      hits: limited,
      conflicts,
      clusters,
      omitted,
      explanation,
    });

    this.cache.set(cacheKey, context);

    const metrics = this.evaluator.evaluate({
      selected: limited,
      allCandidateCount: rawHits.length,
      tokenEstimate: context.tokenEstimate,
      tokenBudget: budget.maxTokens,
      context,
    });

    return {
      query,
      context,
      budget,
      metrics,
      compression: {
        savedTokens: compressed.savedTokens,
        techniques: compressed.techniques,
      },
      cacheHit: false,
    };
  }

  async architectureContext(input: Omit<RetrievalInput, 'agentMode'>): Promise<RetrievalResult> {
    return this.retrieve({ ...input, agentMode: 'architect' });
  }

  recordFeedback(feedback: RetrievalFeedback): RankingWeights {
    this.rankingWeights = this.learning.record(feedback);
    this.cache.invalidate();
    return this.rankingWeights;
  }

  invalidateCache(prefix?: string): void {
    this.cache.invalidate(prefix);
  }
}

export function createRetrievalEngine(options?: {
  retrievers?: Retriever[];
  reranker?: Reranker;
  cacheTtlMs?: number;
  rankingWeights?: Partial<RankingWeights>;
}): RetrievalEngine {
  return new RetrievalEngine(options?.retrievers, options?.reranker, {
    cacheTtlMs: options?.cacheTtlMs,
    rankingWeights: options?.rankingWeights,
  });
}
