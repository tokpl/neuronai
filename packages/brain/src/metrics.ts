import type { ActiveContext, KnowledgePlane, ProjectDna, ProjectGoals, ProjectHealth } from './models.js';

export type MetricKind = 'measured' | 'estimated' | 'derived';

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

export type MetricsInput = {
  dna: ProjectDna;
  knowledge: KnowledgePlane;
  health: ProjectHealth;
  goals: ProjectGoals;
  active: ActiveContext;
  /** Optional: engine active memory count if different from knowledge plane */
  engineMemoryCount?: number;
  /** First brain / prefs init ISO */
  initializedAt?: string | null;
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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function metric(
  partial: Omit<BrainMetric, 'display'> & { display?: string },
): BrainMetric {
  const display =
    partial.display ??
    (partial.value === null ? '—' : String(partial.value));
  return { ...partial, display };
}

/**
 * Build truthful Brain Metrics from ProjectBrain state.
 * Estimates are heuristic and always labeled `estimated`.
 */
export function computeBrainMetrics(input: MetricsInput): BrainMetricsSnapshot {
  const { dna, knowledge, health, goals, active } = input;
  const decisions = knowledge.decisions.length;
  const rules = knowledge.rules.length;
  const insights = knowledge.insights.length;
  const memoryEntries = knowledge.memory.length;
  const knowledgeEntries = memoryEntries + decisions + rules + insights + knowledge.context.length;
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

  const knowledgeConfidenceFixed =
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
  const currentGoal =
    goals.goals.find((g) => g.id === goals.currentId)?.title ??
    goals.goals.find((g) => g.status === 'active')?.title ??
    null;

  const measured: BrainMetric[] = [
    metric({
      key: 'health',
      label: 'Health',
      value: health.score,
      display: `${health.score}%`,
      kind: 'measured',
      explanation: [
        `Health is computed from DNA presence (${health.dnaFresh ? 'yes' : 'no'}),`,
        `knowledge freshness (${health.knowledgeFresh ? 'yes' : 'no'}),`,
        `and DNA overallConfidence (${dnaConfidence}%).`,
        `Notes: ${health.notes.join('; ') || 'none'}.`,
      ].join(' '),
      sources: ['.neuron/brain/health.json', '.neuron/brain/dna.json', '.neuron/brain/knowledge.json'],
    }),
    metric({
      key: 'knowledge_entries',
      label: 'Knowledge Entries',
      value: knowledgeEntries,
      kind: 'measured',
      explanation: `Count of memory (${memoryEntries}) + decisions (${decisions}) + rules (${rules}) + insights (${insights}) + context crumbs (${knowledge.context.length}) in knowledge.json.`,
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
      key: 'important_insights',
      label: 'Important Insights',
      value: insights,
      kind: 'measured',
      explanation: 'Length of knowledge.insights array.',
      sources: ['.neuron/brain/knowledge.json#insights'],
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
      sources: ['.neuron/brain/dna.json#structure.modules', '.neuron/brain/knowledge.json#graph.nodes'],
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
    metric({
      key: 'current_goal',
      label: 'Current Goal',
      value: null,
      display: currentGoal ?? '—',
      kind: 'measured',
      explanation: 'Active / current goal title from goals.json.',
      sources: ['.neuron/brain/goals.json'],
    }),
    metric({
      key: 'current_context',
      label: 'Current Context',
      value: null,
      display: active.focus ?? '—',
      kind: 'measured',
      explanation: 'active.focus from active.json.',
      sources: ['.neuron/brain/active.json'],
    }),
  ];

  const derived: BrainMetric[] = [
    metric({
      key: 'knowledge_confidence',
      label: 'Knowledge Confidence',
      value: knowledgeConfidenceFixed,
      display: `${knowledgeConfidenceFixed}%`,
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

  // Honest heuristics — labeled estimated, never sold as facts
  const reuseScore = Math.min(0.92, decisions * 0.02 + rules * 0.015 + knowledgeEntries * 0.004);
  const estPromptReductionPct = Math.round(reuseScore * 100);
  const avgDecisionTokens = 180;
  const estTokensSaved = decisions * avgDecisionTokens * 12; // assume ~12 reuses
  const estHoursSaved = Math.round((estTokensSaved / 4000) * 10) / 10; // ~4k tokens ≈ 1 “dev focus unit”

  const estimated: BrainMetric[] = [
    metric({
      key: 'est_prompt_reduction_pct',
      label: 'Estimated Prompt Reduction',
      value: estPromptReductionPct,
      display: `${estPromptReductionPct}%`,
      kind: 'estimated',
      explanation:
        'Heuristic from decision/rule/knowledge counts (capped). Not measured from real prompt logs. Treat as directional only.',
      sources: ['knowledge.decisions', 'knowledge.rules', 'knowledge entry counts'],
    }),
    metric({
      key: 'est_tokens_saved',
      label: 'Estimated Context Saved',
      value: estTokensSaved,
      display: formatTokens(estTokensSaved),
      kind: 'estimated',
      explanation: `Heuristic: decisions × ${avgDecisionTokens} tokens × 12 assumed reuses. Not measured from LLM usage.`,
      sources: ['knowledge.decisions.length'],
    }),
    metric({
      key: 'est_time_saved_hours',
      label: 'Estimated Developer Time Saved',
      value: estHoursSaved,
      display: `${estHoursSaved}h`,
      kind: 'estimated',
      explanation:
        'Heuristic from estimated tokens saved (÷ ~4000). Not calendar time. Directional only.',
      sources: ['est_tokens_saved'],
    }),
    metric({
      key: 'est_context_reuse_pct',
      label: 'Estimated Context Reuse',
      value: estPromptReductionPct,
      display: `${estPromptReductionPct}%`,
      kind: 'estimated',
      explanation: 'Same heuristic as Estimated Prompt Reduction until real prompt telemetry exists.',
      sources: ['est_prompt_reduction_pct'],
    }),
  ];

  const all = [...measured, ...derived, ...estimated];
  const byKey: Record<string, BrainMetric> = {};
  for (const m of all) byKey[m.key] = m;

  return { measured, derived, estimated, byKey };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tokens`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k tokens`;
  return `${n} tokens`;
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

  const blocks: string[] = ['🧠 Project Brain', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', ''];

  const order = [
    'health',
    'knowledge_confidence',
    'architecture_confidence',
    'dna_confidence',
    'current_goal',
    'current_context',
    'brain_age_days',
    'last_evolution',
    'knowledge_entries',
    'architecture_decisions',
    'business_rules',
    'important_insights',
    'relationships',
    'modules_understood',
    'files_understood',
    'est_prompt_reduction_pct',
    'est_tokens_saved',
    'est_time_saved_hours',
  ];

  for (const key of order) {
    const m = snapshot.byKey[key];
    if (!m) continue;
    blocks.push(line(m), '');
  }

  blocks.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  blocks.push('');
  blocks.push('Your AI understands this project.');
  blocks.push('Estimates are labeled and heuristic — not measured usage.');
  return blocks.join('\n');
}
