import type { PreparationMode } from './modes.js';

export type CompressionMetricKind = 'measured' | 'derived' | 'estimated';

export interface CompressionMetrics {
  mode: PreparationMode;
  tokenBudget: number;
  /** Memories in the corpus before retrieval filtered them. */
  candidates: number;
  /** Memories that passed the relevance gate. */
  relevant: number;
  /** Memories rendered into the compiled context. */
  selected: number;
  /** candidates − selected (measured). */
  discarded: number;
  /** Duplicate memories collapsed before compiling (measured). */
  duplicatesRemoved: number;
  /** Estimated tokens in the compiled context. */
  compiledTokens: number;
  /** Estimated tokens if every candidate were pasted verbatim. */
  rawCorpusTokens: number;
  /** rawCorpusTokens / max(compiledTokens,1) — derived. */
  compressionRatio: number;
  /** Wall time spent ranking (ms). */
  retrievalMs: number;
  /** Wall time spent compiling (ms). */
  compileMs: number;
  kindNotes: Record<string, CompressionMetricKind>;
}

export function buildCompressionMetrics(input: {
  mode: PreparationMode;
  tokenBudget: number;
  candidates: number;
  relevant: number;
  selected: number;
  duplicatesRemoved: number;
  compiledTokens: number;
  rawCorpusTokens: number;
  retrievalMs: number;
  compileMs: number;
}): CompressionMetrics {
  const compressionRatio = input.rawCorpusTokens / Math.max(1, input.compiledTokens);

  return {
    mode: input.mode,
    tokenBudget: input.tokenBudget,
    candidates: input.candidates,
    relevant: input.relevant,
    selected: input.selected,
    discarded: Math.max(0, input.candidates - input.selected),
    duplicatesRemoved: input.duplicatesRemoved,
    compiledTokens: input.compiledTokens,
    rawCorpusTokens: input.rawCorpusTokens,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    retrievalMs: input.retrievalMs,
    compileMs: input.compileMs,
    kindNotes: {
      candidates: 'measured',
      relevant: 'measured',
      selected: 'measured',
      discarded: 'measured',
      duplicatesRemoved: 'measured',
      compiledTokens: 'estimated',
      rawCorpusTokens: 'estimated',
      compressionRatio: 'derived',
      retrievalMs: 'measured',
      compileMs: 'measured',
      tokenBudget: 'measured',
    },
  };
}

const EXPLANATIONS: Record<string, string> = {
  candidates: 'Memories in the brain before retrieval ran (measured).',
  relevant: 'Memories that shared at least one subject term with the task (measured).',
  selected: 'Memories rendered into the compiled context after budget packing (measured).',
  discarded: 'candidates − selected (measured).',
  duplicatesRemoved: 'Memories collapsed because they carried the same knowledge (measured).',
  compiledTokens: 'estimateTokens(context) using chars/4 — a heuristic, not a billed count.',
  rawCorpusTokens: 'estimateTokens of every candidate pasted verbatim — the no-Neuron baseline.',
  compressionRatio: 'rawCorpusTokens / compiledTokens (derived). Higher means more filtering.',
  retrievalMs: 'Wall-clock ms spent ranking memories (measured).',
  compileMs: 'Wall-clock ms spent building the context (measured).',
  tokenBudget: 'Hard token ceiling for this mode (measured against compiledTokens).',
};

export function explainCompressionMetric(metrics: CompressionMetrics, key: string): string {
  const kind = metrics.kindNotes[key] ?? 'measured';
  const value = (metrics as unknown as Record<string, unknown>)[key];
  return [
    `${key}: ${String(value)}`,
    `Kind: ${kind}`,
    EXPLANATIONS[key] ?? 'No explanation registered for this key.',
    `Mode: ${metrics.mode} · budget ${metrics.tokenBudget} tokens`,
  ].join('\n');
}
