import type { KnowledgePlane, ProjectDna, ProjectHealth } from './models.js';

export type MetricKind = 'measured' | 'derived' | 'estimated';

export interface BrainMetric {
  key: string;
  label: string;
  /** Display value */
  display: string;
  /** Numeric when applicable */
  value: number | null;
  kind: MetricKind;
  /** Human explanation of how the value was produced */
  explanation: string;
  /** Concrete data sources used */
  sources: string[];
}

export interface BrainMetricsSnapshot {
  measured: BrainMetric[];
  derived: BrainMetric[];
  estimated: BrainMetric[];
  /** Flat lookup */
  byKey: Record<string, BrainMetric>;
}

/** Real numbers from the most recent context compilation, when one has run. */
export interface LastCompressionSample {
  mode: string;
  candidates: number;
  selected: number;
  compiledTokens: number;
  rawCorpusTokens: number;
  compressionRatio: number;
  retrievalMs: number;
  duplicatesRemoved: number;
}

export type MetricsInput = {
  dna: ProjectDna;
  knowledge: KnowledgePlane;
  health: ProjectHealth;
  /** First brain / prefs init ISO */
  initializedAt?: string | null;
  /** Measured compression from the last `prepareContext` run. */
  lastCompression?: LastCompressionSample | null;
};

function daysBetween(fromIso: string, to = Date.now()): number {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((to - t) / 86_400_000));
}

function relativeAge(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'unknown';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function metric(partial: Omit<BrainMetric, 'display'> & { display?: string }): BrainMetric {
  const display = partial.display ?? (partial.value === null ? '—' : String(partial.value));
  return { ...partial, display };
}

/**
 * Build truthful Brain Metrics from ProjectBrain state.
 *
 * Every value is either counted from disk (`measured`), computed from counted
 * values (`derived`), or a labeled heuristic (`estimated`). Nothing is invented:
 * compression numbers only appear once a real compilation has produced them.
 */
export function computeBrainMetrics(input: MetricsInput): BrainMetricsSnapshot {
  const { dna, knowledge, health } = input;
  const decisions = knowledge.decisions.length;
  const rules = knowledge.rules.length;
  const memoryEntries = knowledge.memory.length;
  const knowledgeEntries = memoryEntries + decisions + rules;
  const relationships = knowledge.graph.edges?.length ?? 0;
  const nodes = knowledge.graph.nodes?.length ?? 0;

  const moduleFacet = dna.structure.modules?.value?.length ?? 0;
  const modulesUnderstood = moduleFacet > 0 ? moduleFacet : nodes;

  const dnaConfidence = Math.round((dna.meta.overallConfidence || 0) * 100);
  const decisionConfidence =
    decisions === 0
      ? 0
      : Math.round(
          (knowledge.decisions.reduce((s, d) => s + (d.confidenceScore ?? 0.7), 0) / decisions) *
            100,
        );
  const architectureConfidence = Math.round(
    dnaConfidence * 0.45 + decisionConfidence * 0.4 + (health.architectureHealthy ? 15 : 0),
  );

  const knowledgeConfidence =
    knowledgeEntries === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (health.knowledgeFresh ? 25 : 0) +
              Math.min(50, knowledgeEntries * 2) +
              dnaConfidence * 0.25,
          ),
        );

  const initAt = input.initializedAt ?? dna.meta.generatedAt;
  const brainAgeDays = daysBetween(initAt);
  const lastEvolution = knowledge.updatedAt || health.updatedAt;

  const measured: BrainMetric[] = [
    metric({
      key: 'health',
      label: 'Health',
      value: health.score,
      display: `${health.score}%`,
      kind: 'measured',
      explanation: [
        `Computed from DNA presence (${health.dnaFresh ? 'yes' : 'no'}),`,
        `knowledge freshness (${health.knowledgeFresh ? 'yes' : 'no'}),`,
        `and DNA overallConfidence (${dnaConfidence}%).`,
        `Notes: ${health.notes.join('; ') || 'none'}.`,
      ].join(' '),
      sources: [
        '.neuron/brain/health.json',
        '.neuron/brain/dna.json',
        '.neuron/brain/knowledge.json',
      ],
    }),
    metric({
      key: 'knowledge_entries',
      label: 'Knowledge Entries',
      value: knowledgeEntries,
      kind: 'measured',
      explanation: `Count of memory (${memoryEntries}) + decisions (${decisions}) + rules (${rules}) in knowledge.json.`,
      sources: ['.neuron/brain/knowledge.json'],
    }),
    metric({
      key: 'architecture_decisions',
      label: 'Architecture Decisions',
      value: decisions,
      kind: 'measured',
      explanation: 'Length of knowledge.decisions array.',
      sources: ['.neuron/brain/knowledge.json#decisions'],
    }),
    metric({
      key: 'business_rules',
      label: 'Business Rules',
      value: rules,
      kind: 'measured',
      explanation: 'Length of knowledge.rules array.',
      sources: ['.neuron/brain/knowledge.json#rules'],
    }),
    metric({
      key: 'relationships',
      label: 'Relationships',
      value: relationships,
      kind: 'measured',
      explanation: 'Count of edges in knowledge.graph.',
      sources: ['.neuron/brain/knowledge.json#graph.edges'],
    }),
    metric({
      key: 'modules_understood',
      label: 'Modules Understood',
      value: modulesUnderstood,
      kind: 'measured',
      explanation:
        moduleFacet > 0
          ? 'Count of DNA structure.modules facet values.'
          : 'Fallback: count of graph nodes (DNA modules facet empty).',
      sources: [
        '.neuron/brain/dna.json#structure.modules',
        '.neuron/brain/knowledge.json#graph.nodes',
      ],
    }),
    metric({
      key: 'files_understood',
      label: 'Files Understood',
      value: nodes,
      kind: 'measured',
      explanation: 'Count of graph nodes (proxy for files/modules indexed in the Brain graph).',
      sources: ['.neuron/brain/knowledge.json#graph.nodes'],
    }),
    metric({
      key: 'brain_age_days',
      label: 'Brain Age',
      value: brainAgeDays,
      display: `${brainAgeDays} day${brainAgeDays === 1 ? '' : 's'}`,
      kind: 'measured',
      explanation: `Days since DNA meta.generatedAt / init (${initAt}).`,
      sources: ['.neuron/brain/dna.json#meta.generatedAt'],
    }),
    metric({
      key: 'last_evolution',
      label: 'Last Evolution',
      value: null,
      display: relativeAge(lastEvolution),
      kind: 'measured',
      explanation: `Relative time since knowledge.updatedAt (${lastEvolution}).`,
      sources: ['.neuron/brain/knowledge.json#updatedAt'],
    }),
  ];

  const sample = input.lastCompression;
  if (sample) {
    measured.push(
      metric({
        key: 'last_context_tokens',
        label: 'Last Compiled Context',
        value: sample.compiledTokens,
        display: `${sample.compiledTokens} tokens (${sample.mode})`,
        kind: 'measured',
        explanation: `Selected ${sample.selected} of ${sample.candidates} memories. Ranking took ${sample.retrievalMs}ms.`,
        sources: ['last prepareContext() run'],
      }),
      metric({
        key: 'last_duplicates_removed',
        label: 'Duplicates Removed',
        value: sample.duplicatesRemoved,
        kind: 'measured',
        explanation: 'Memories collapsed as duplicate knowledge during the last compilation.',
        sources: ['last prepareContext() run'],
      }),
    );
  }

  const derived: BrainMetric[] = [
    metric({
      key: 'knowledge_confidence',
      label: 'Knowledge Confidence',
      value: knowledgeConfidence,
      display: `${knowledgeConfidence}%`,
      kind: 'derived',
      explanation:
        'Derived from knowledge freshness flag, entry count (capped), and DNA overallConfidence. Not a model probability.',
      sources: ['health.knowledgeFresh', 'knowledge entry counts', 'dna.meta.overallConfidence'],
    }),
    metric({
      key: 'architecture_confidence',
      label: 'Architecture Confidence',
      value: architectureConfidence,
      display: `${architectureConfidence}%`,
      kind: 'derived',
      explanation:
        'Derived: 45% DNA overallConfidence + 40% mean decision confidenceScore + 15% if architectureHealthy.',
      sources: [
        'dna.meta.overallConfidence',
        'knowledge.decisions[].confidenceScore',
        'health.architectureHealthy',
      ],
    }),
    metric({
      key: 'dna_confidence',
      label: 'DNA Confidence',
      value: dnaConfidence,
      display: `${dnaConfidence}%`,
      kind: 'derived',
      explanation: 'dna.meta.overallConfidence × 100.',
      sources: ['.neuron/brain/dna.json#meta.overallConfidence'],
    }),
  ];

  if (sample) {
    derived.push(
      metric({
        key: 'compression_ratio',
        label: 'Compression Ratio',
        value: sample.compressionRatio,
        display: `${sample.compressionRatio}×`,
        kind: 'derived',
        explanation: `Full candidate set was ~${sample.rawCorpusTokens} tokens; the compiled context was ${sample.compiledTokens}.`,
        sources: ['last prepareContext() run'],
      }),
    );
  }

  // Token counts use a chars/4 heuristic rather than a real tokenizer.
  const estimated: BrainMetric[] = sample
    ? [
        metric({
          key: 'est_raw_corpus_tokens',
          label: 'Uncompressed Corpus',
          value: sample.rawCorpusTokens,
          display: `${sample.rawCorpusTokens} tokens`,
          kind: 'estimated',
          explanation:
            'What the matching memories would cost if pasted verbatim. chars/4 heuristic, not a billed count.',
          sources: ['last prepareContext() run'],
        }),
      ]
    : [];

  const all = [...measured, ...derived, ...estimated];
  const byKey: Record<string, BrainMetric> = {};
  for (const m of all) byKey[m.key] = m;

  return { measured, derived, estimated, byKey };
}

export function explainMetric(snapshot: BrainMetricsSnapshot, key: string): string {
  const m = snapshot.byKey[key];
  if (!m) {
    return `Unknown metric "${key}". Available: ${Object.keys(snapshot.byKey).join(', ')}`;
  }
  return [
    `${m.label}: ${m.display}`,
    `Kind: ${m.kind}`,
    m.explanation,
    `Sources: ${m.sources.join(' · ')}`,
  ].join('\n');
}

export function formatBrainMetricsReport(snapshot: BrainMetricsSnapshot): string {
  const line = (m: BrainMetric) => {
    const tag = m.kind === 'measured' ? '' : m.kind === 'derived' ? ' (derived)' : ' (estimated)';
    return `${m.label}${tag}\n${m.display}`;
  };

  const blocks: string[] = ['Project Brain', '------------------------------', ''];

  const order = [
    'health',
    'knowledge_confidence',
    'architecture_confidence',
    'dna_confidence',
    'brain_age_days',
    'last_evolution',
    'knowledge_entries',
    'architecture_decisions',
    'business_rules',
    'relationships',
    'modules_understood',
    'files_understood',
    'last_context_tokens',
    'compression_ratio',
    'last_duplicates_removed',
    'est_raw_corpus_tokens',
  ];

  for (const key of order) {
    const m = snapshot.byKey[key];
    if (!m) continue;
    blocks.push(line(m), '');
  }

  blocks.push('------------------------------', '');
  blocks.push('Measured values are counted from .neuron/. Derived values are computed from them.');
  blocks.push('Estimated values use a chars/4 token heuristic and are labeled as such.');
  return blocks.join('\n');
}
