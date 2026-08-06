import { createBrainCompiler, estimateTokens, type CompiledContext } from './compiler/index.js';
import { resolvePreparationMode } from './compiler/modes.js';
import type { ProjectMapEntry } from './models.js';
import {
  dedupeRetrievalHits,
  retrieve,
  type RetrievalDoc,
  type RetrievalHit,
} from './retrieval/index.js';
import type { QueryIntent } from './retrieval/intent.js';
import { pickRecommendation, type ModificationAdvice } from './retrieval/recommend.js';

/**
 * The single path from stored knowledge to agent-facing context.
 *
 * Retrieval decides relevance, the compiler decides shape. Adapters (CLI, MCP)
 * only supply documents — they never rank or format on their own.
 */

export interface PrepareContextInput {
  task: string;
  /** Preparation mode string; defaults to minimal. */
  mode?: string;
  /** Candidate knowledge, typically `brainDocs(brain)`. */
  docs: RetrievalDoc[];
  /** Files or modules the task touches. */
  modules?: string[];
}

/** What the agent should open, in structured form. */
export interface RelevantLocation {
  name: string;
  path: string;
  kind: ProjectMapEntry['kind'];
  purpose?: string;
  /** Owning module name when known. */
  module?: string;
  /**
   * Plain-language reason this was selected.
   * Safe in structured MCP/CLI output; ranking scores stay out of `context`.
   */
  why: string;
}

export interface RelevantRule {
  title: string;
  detail: string;
}

export interface ContextEfficiency {
  contextTokens: number;
  budgetTokens: number;
  corpusTokens: number;
  itemsSelected: number;
  itemsDiscarded: number;
  compressionRatio: number;
  /**
   * Tokens the agent did not have to spend. Baseline is explicit: everything the
   * brain could have said about this project, pasted verbatim, minus what was
   * actually sent. It is not a measurement of the agent's own file reading.
   */
  estimatedTokensSaved: number;
  baseline: 'whole-brain-verbatim';
  retrievalMs: number;
}

export interface PreparedContext extends CompiledContext {
  /** Ranked hits behind the compiled text. For CLI/debug use, never for the prompt. */
  hits: RetrievalHit[];
  intent: QueryIntent;
  concepts: string[];
  relevantFiles: RelevantLocation[];
  relevantModules: RelevantLocation[];
  relevantRules: RelevantRule[];
  /** Best place to start when the task is about adding or changing code. */
  recommendation?: ModificationAdvice;
  efficiency: ContextEfficiency;
}

export function prepareContext(input: PrepareContextInput): PreparedContext {
  const profile = resolvePreparationMode(input.mode);

  const raw = retrieve(input.task, input.docs, { limit: profile.retrieveLimit * 2 });
  const hits = dedupeRetrievalHits(raw.hits).slice(0, profile.retrieveLimit);
  const result = { ...raw, hits };

  // Baseline for savings: what pasting the whole brain would cost.
  const corpusTokens = input.docs.reduce(
    (sum, doc) => sum + estimateTokens(`${doc.title}\n${doc.content}`),
    0,
  );

  // Provisional inclusion set from ranked hits (titles the compiler may keep).
  const provisionalTitles = new Set(result.hits.map((h) => h.doc.title));
  const recommendation = pickRecommendation(
    result.stats.intent,
    result.hits,
    provisionalTitles,
    input.task,
  );

  const compiled = createBrainCompiler().compile({
    task: input.task,
    mode: input.mode,
    hits: result.hits,
    modules: input.modules,
    recommendation: recommendation
      ? {
          path: recommendation.path,
          name: recommendation.name,
          reason: recommendation.reason,
          related: recommendation.related,
        }
      : undefined,
    corpusTokens,
    retrieval: {
      candidates: result.stats.candidates,
      matched: result.stats.matched,
      durationMs: result.stats.durationMs,
    },
  });

  // Only report locations that actually made it into the compiled context.
  const included = new Set(compiled.sources.map((s) => s.title));
  // Recommendation path also counts as included for structured fields.
  if (recommendation) {
    for (const hit of result.hits) {
      if (hit.doc.location?.path === recommendation.path) included.add(hit.doc.title);
    }
  }

  const locations = result.hits.filter(
    (hit) => hit.doc.location && included.has(hit.doc.title),
  );

  const toLocation = (hit: RetrievalHit): RelevantLocation => ({
    name: hit.doc.location!.name,
    path: hit.doc.location!.path,
    kind: hit.doc.location!.kind,
    purpose: hit.doc.location!.purpose,
    module: hit.doc.location!.module,
    why: humanWhy(hit),
  });

  const relevantRules: RelevantRule[] = [];
  const seenRules = new Set<string>();
  for (const hit of result.hits) {
    if (hit.doc.kind !== 'rule' || !included.has(hit.doc.title)) continue;
    const key = hit.doc.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenRules.has(key)) continue;
    seenRules.add(key);
    relevantRules.push({ title: hit.doc.title, detail: hit.doc.content });
  }

  const finalRecommendation =
    recommendation &&
    (compiled.context.includes(recommendation.path) || included.size > 0)
      ? recommendation
      : undefined;

  return {
    ...compiled,
    hits: result.hits,
    intent: result.stats.intent,
    concepts: result.stats.concepts,
    relevantModules: locations.filter((h) => h.doc.location!.kind === 'module').map(toLocation),
    relevantFiles: locations.filter((h) => h.doc.location!.kind !== 'module').map(toLocation),
    relevantRules,
    recommendation: finalRecommendation,
    efficiency: {
      contextTokens: compiled.metrics.compiledTokens,
      budgetTokens: compiled.metrics.tokenBudget,
      corpusTokens: compiled.metrics.rawCorpusTokens,
      itemsSelected: compiled.metrics.selected,
      itemsDiscarded: compiled.metrics.discarded,
      compressionRatio: compiled.metrics.compressionRatio,
      estimatedTokensSaved: Math.max(0, corpusTokens - compiled.metrics.compiledTokens),
      baseline: 'whole-brain-verbatim',
      retrievalMs: compiled.metrics.retrievalMs,
    },
  };
}

/** Strip ranking jargon so structured "why" stays human. */
function humanWhy(hit: RetrievalHit): string {
  const loc = hit.doc.location;
  const parts = [
    loc?.purpose,
    loc?.module ? `${loc.module} module` : undefined,
    loc?.kind === 'symbol' ? `defines ${loc.name}` : undefined,
  ].filter(Boolean);
  if (parts.length) return parts.join('; ');
  return hit.why
    .replace(/\b\d+(\.\d+)?%\s+of task terms\b/gi, '')
    .replace(/\b(score|ranking|bm25)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
