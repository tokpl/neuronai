import type { BenchmarkSuiteResult } from '../types.js';
import { pct } from '../types.js';

export function renderBenchmarkReport(result: BenchmarkSuiteResult): string {
  const m = result.metrics;
  const c = result.comparison;
  const archLift = pct(
    c.withNeuron.architectureCompliance - c.withoutNeuron.architectureCompliance,
  );

  return [
    '# Neuron Evaluation',
    '',
    `_Generated: ${result.generatedAt}_`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Context accuracy (precision) | ${fmtPct(m.contextPrecision)} |`,
    `| Context recall | ${fmtPct(m.contextRecall)} |`,
    `| Token reduction | ${c.tokenReductionPct}% |`,
    `| Architecture consistency lift | +${archLift}% |`,
    `| Task success (with Neuron) | ${fmtPct(c.withNeuron.taskSuccessRate)} |`,
    `| Regression rate (with Neuron) | ${fmtPct(c.withNeuron.regressionRate)} |`,
    `| Memory quality gate accuracy | ${fmtPct(result.memoryQuality.accuracy)} |`,
    '',
    '## Comparison mode',
    '',
    '| | WITHOUT_NEURON | WITH_NEURON |',
    '|-|----------------|------------|',
    `| Tokens | ${c.withoutNeuron.tokenEstimate} | ${c.withNeuron.tokenEstimate} |`,
    `| Precision | ${fmtPct(c.withoutNeuron.contextPrecision)} | ${fmtPct(c.withNeuron.contextPrecision)} |`,
    `| Recall | ${fmtPct(c.withoutNeuron.contextRecall)} | ${fmtPct(c.withNeuron.contextRecall)} |`,
    `| Architecture compliance | ${fmtPct(c.withoutNeuron.architectureCompliance)} | ${fmtPct(c.withNeuron.architectureCompliance)} |`,
    '',
    '## Token optimization',
    '',
    `- Before (raw): **${result.tokenOptimization.beforeTokens}** tokens`,
    `- After (Neuron): **${result.tokenOptimization.afterTokens}** tokens`,
    `- Information preserved: **${result.tokenOptimization.informationPreservedPct}%**`,
    '',
    '## Retrieval benchmark',
    '',
    '| Memories | Latency (ms) | Tokens | Ranking quality | Budget |',
    '|----------|-------------:|-------:|----------------:|-------:|',
    ...result.retrieval.map(
      (r) =>
        `| ${r.memoryCount} | ${r.latencyMs} | ${r.tokenEstimate} | ${fmtPct(r.rankingQuality)} | ${r.budget} |`,
    ),
    '',
    '## Onboarding',
    '',
    `- Without Neuron: ~${result.onboarding.withoutNeuronMinutes} min (facts ${result.onboarding.factsCoveredWithout})`,
    `- With Neuron: ~${result.onboarding.withNeuronMinutes} min (facts ${result.onboarding.factsCoveredWith})`,
    `- Speedup: **${result.onboarding.speedupPct}%**`,
    '',
    '## Projects',
    '',
    ...result.projects.map((p) => `- ${p}`),
    '',
    '## Tasks',
    '',
    ...result.tasks.map((t) => `- ${t}`),
    '',
    '_Measures the memory layer only — no LLM training or autonomous agent._',
  ].join('\n');
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
