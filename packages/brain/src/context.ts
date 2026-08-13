import { createBrainCompiler, estimateTokens, type CompiledContext } from './compiler/index.js';
import { resolvePreparationMode } from './compiler/modes.js';
import { buildContextContribution, type ContextContribution } from './contribution.js';
import type { ProjectMapEntry } from './models.js';
import {
  dedupeRetrievalHits,
  diversifyRetrievalHits,
  retrieve,
  type RetrievalDoc,
  type RetrievalHit,
} from './retrieval/index.js';
import { expandConnectedSlice } from './retrieval/code-docs.js';
import type { QueryIntent } from './retrieval/intent.js';
import { pickRecommendation, type ModificationAdvice } from './retrieval/recommend.js';
import type { CodeIntelligence } from '@neuronai/types';

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
  /** Optional structural code plane for dependency expansion. */
  code?: CodeIntelligence;
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
   * Tokens of *matched knowledge* not packed into the compiled context.
   * Baseline is memories/decisions/rules/dna that passed the relevance gate —
   * not the structural map/code index (those can be hundreds of docs and would
   * make savings look like a constant ~brain-scan size). Not agent file-read savings.
   */
  estimatedTokensSaved: number;
  baseline: 'matched-knowledge-verbatim';
  retrievalMs: number;
  /**
   * Simulated estimate of structural rediscovery avoided (map + symbols + edges
   * the agent would otherwise explore). Not measured agent file-read savings.
   */
  estimatedRediscoveryAvoided?: number;
  rediscoveryBaseline?: 'simulated-structural-exploration';
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
  /** Verified flow when evidence exists. */
  flow?: Array<{ label: string; path?: string }>;
  efficiency: ContextEfficiency;
  /** Ready-to-print contribution footer for CLI / Cursor agents. */
  contribution: ContextContribution;
}

export function prepareContext(input: PrepareContextInput): PreparedContext {
  const profile = resolvePreparationMode(input.mode);

  const raw = retrieve(input.task, input.docs, { limit: profile.retrieveLimit * 2 });
  const hits = diversifyRetrievalHits(
    dedupeRetrievalHits(raw.hits),
    raw.stats.intent,
    profile.retrieveLimit,
  );
  const result = { ...raw, hits };

  // Provisional inclusion set from ranked hits (titles the compiler may keep).
  const provisionalTitles = new Set(result.hits.map((h) => h.doc.title));
  const baseRecommendation = pickRecommendation(
    result.stats.intent,
    result.hits,
    provisionalTitles,
    input.task,
  );

  const slice = expandConnectedSlice(input.code, baseRecommendation, result.stats.intent);
  const recommendation: ModificationAdvice | undefined = baseRecommendation
    ? {
        ...baseRecommendation,
        symbol: slice.symbol,
        related: slice.related.length ? slice.related : baseRecommendation.related,
        flow: slice.flow.length ? slice.flow : undefined,
        dependencies: slice.dependencies.map((d) => ({ path: d.path, name: d.name })),
        tests: slice.tests.length ? slice.tests : undefined,
        reason: enrichReason(baseRecommendation.reason, slice.symbol, slice.flow),
      }
    : undefined;

  // Savings baseline: matched *knowledge* only. Map/code location docs are for
  // retrieval + pointers — counting them made footers stick at ~20–30k on scanned repos.
  const corpusTokens = result.hits
    .filter((hit) => isKnowledgeDoc(hit.doc))
    .reduce((sum, hit) => sum + estimateTokens(`${hit.doc.title}\n${hit.doc.content}`), 0);

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
          symbol: recommendation.symbol,
          flow: recommendation.flow,
          dependencies: recommendation.dependencies,
          tests: recommendation.tests,
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

  const structuralNodes =
    (input.code?.files.length ?? 0) +
    (input.code?.symbols.length ?? 0) +
    (input.code?.edges.filter((e) => e.confidence === 'high').length ?? 0);
  // Rough: each structural fact ≈ ~12 tokens if rediscovered via search/open.
  const estimatedRediscoveryAvoided = Math.max(
    0,
    Math.min(structuralNodes, 40) * 12 + (slice.flow.length + slice.dependencies.length) * 25,
  );

  const relevantModules = locations
    .filter((h) => h.doc.location!.kind === 'module')
    .map(toLocation);
  const relevantFiles = locations
    .filter((h) => h.doc.location!.kind !== 'module')
    .map(toLocation);

  // Contribution counts: knowledge only — never treat map/code locations as "memories".
  const matchedKnowledge = result.hits.filter((h) => isKnowledgeDoc(h.doc));
  const selectedKnowledge = matchedKnowledge.filter((h) => included.has(h.doc.title));
  const memoriesUsed = selectedKnowledge.filter((h) => h.doc.kind !== 'rule').length;
  const memoriesSkipped = Math.max(0, matchedKnowledge.length - selectedKnowledge.length);

  const efficiency: ContextEfficiency = {
    contextTokens: compiled.metrics.compiledTokens,
    budgetTokens: compiled.metrics.tokenBudget,
    corpusTokens: compiled.metrics.rawCorpusTokens,
    itemsSelected: compiled.metrics.selected,
    itemsDiscarded: compiled.metrics.discarded,
    compressionRatio: compiled.metrics.compressionRatio,
    // corpus is matched knowledge only; location-heavy packs cannot invent negative knowledge savings.
    estimatedTokensSaved: Math.max(0, corpusTokens - compiled.metrics.compiledTokens),
    baseline: 'matched-knowledge-verbatim',
    retrievalMs: compiled.metrics.retrievalMs,
    estimatedRediscoveryAvoided,
    rediscoveryBaseline: 'simulated-structural-exploration',
  };

  return {
    ...compiled,
    hits: result.hits,
    intent: result.stats.intent,
    concepts: result.stats.concepts,
    relevantModules,
    relevantFiles,
    relevantRules,
    recommendation: finalRecommendation,
    flow: finalRecommendation?.flow,
    efficiency,
    contribution: buildContextContribution({
      efficiency,
      relevantFiles,
      relevantModules,
      relevantRules,
      recommendationPath: finalRecommendation?.path,
      memoriesUsed,
      memoriesSkipped,
      memoriesInBrain: matchedKnowledge.length,
    }),
  };
}

/** Knowledge plane for compression metrics — excludes map/code location docs. */
function isKnowledgeDoc(doc: RetrievalDoc): boolean {
  return doc.kind !== 'location';
}

function enrichReason(
  base: string,
  symbol?: string,
  flow?: Array<{ label: string; path?: string }>,
): string {
  const parts = [base];
  if (symbol && !base.includes(symbol)) parts.push(`structural focus ${symbol}`);
  if (flow && flow.length > 1) parts.push('verified call/route chain available');
  return parts.filter(Boolean).join('; ');
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
