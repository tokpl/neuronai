import type { PreparationMode } from './modes.js';

export type CompressionMetricKind = 'measured' | 'derived' | 'estimated';

export interface CompressionMetrics {
  mode: PreparationMode;
  tokenBudget: number;
  /** Candidates considered before compression */
  knowledgeSearched: number;
  /** Items that made it into the prompt */
  knowledgeSelected: number;
  /** Dropped as duplicate / over budget / low signal */
  knowledgeDiscarded: number;
  /** searched / max(selected,1) — derived */
  compressionRatio: number;
  /** Prompt size in estimated tokens */
  promptTokens: number;
  /** max(0, searchedApproxTokens - promptTokens) */
  estimatedTokensRemoved: number;
  /** 0..1 estimated reduction vs raw dump size */
  estimatedContextReduction: number;
  /** Wall time for compile step (ms) */
  preparationTimeMs: number;
  kindNotes: Record<string, CompressionMetricKind>;
}

export interface InclusionRecord {
  id: string;
  title: string;
  reason: string;
}

export interface ExclusionRecord {
  id: string;
  title: string;
  reason: string;
}

export function buildCompressionMetrics(input: {
  mode: PreparationMode;
  tokenBudget: number;
  searched: number;
  selected: number;
  discarded: number;
  promptTokens: number;
  rawDumpTokens: number;
  preparationTimeMs: number;
}): CompressionMetrics {
  const compressionRatio =
    input.selected <= 0 ? input.searched : input.searched / input.selected;
  const estimatedTokensRemoved = Math.max(0, input.rawDumpTokens - input.promptTokens);
  const estimatedContextReduction =
    input.rawDumpTokens <= 0
      ? 0
      : Math.min(1, estimatedTokensRemoved / input.rawDumpTokens);

  return {
    mode: input.mode,
    tokenBudget: input.tokenBudget,
    knowledgeSearched: input.searched,
    knowledgeSelected: input.selected,
    knowledgeDiscarded: input.discarded,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    promptTokens: input.promptTokens,
    estimatedTokensRemoved,
    estimatedContextReduction: Math.round(estimatedContextReduction * 1000) / 1000,
    preparationTimeMs: input.preparationTimeMs,
    kindNotes: {
      knowledgeSearched: 'measured',
      knowledgeSelected: 'measured',
      knowledgeDiscarded: 'measured',
      compressionRatio: 'derived',
      promptTokens: 'measured',
      estimatedTokensRemoved: 'estimated',
      estimatedContextReduction: 'estimated',
      preparationTimeMs: 'measured',
    },
  };
}

export function explainCompressionMetric(
  metrics: CompressionMetrics,
  key: string,
): string {
  const kind = metrics.kindNotes[key] ?? 'measured';
  const value = (metrics as unknown as Record<string, unknown>)[key];
  const explanations: Record<string, string> = {
    knowledgeSearched: 'Count of ranked candidates entering the compiler (measured).',
    knowledgeSelected: 'Count of items that survived dedupe + budget packing (measured).',
    knowledgeDiscarded: 'searched − selected (measured).',
    compressionRatio: 'searched / selected (derived). Higher means more filtering.',
    promptTokens: 'estimateTokens(prompt) using chars/4 (measured heuristic).',
    estimatedTokensRemoved:
      'rawDumpTokens − promptTokens. Raw dump is the verbose internal assembly — estimated reduction, not a billable LLM meter.',
    estimatedContextReduction: 'estimatedTokensRemoved / rawDumpTokens (estimated).',
    preparationTimeMs: 'Wall-clock ms for the compile step (measured).',
    tokenBudget: 'Soft max tokens for this preparation mode (configured).',
  };
  return [
    `${key}: ${String(value)}`,
    `Kind: ${kind}`,
    explanations[key] ?? 'No explanation registered for this key.',
    `Mode: ${metrics.mode} · budget ${metrics.tokenBudget}`,
  ].join('\n');
}
