import type { CompiledBrainPrompt } from '@neuronai/brain';

import type { AgentContext } from '../context/context-engine.js';
import type { ImplementationPlan } from './implementation-planner.js';

export interface PreparationReport {
  /** Dense prompt for the LLM — single representation, no JSON twin */
  prompt: string;
  /** Compression metrics + explainability trail */
  compiled: CompiledBrainPrompt;
  context: AgentContext;
  plan?: ImplementationPlan;
  /**
   * @deprecated Alias of `prompt` (kept so older hosts do not break).
   * Never a verbose duplicate of the briefing.
   */
  markdown: string;
}

/**
 * @deprecated Prefer BrainCompiler via AgentIntelligence.prepareTask.
 * Kept for callers that only have AgentContext.
 */
export function buildPreparationReport(
  context: AgentContext,
  plan?: ImplementationPlan,
): PreparationReport {
  const lines = [
    `# Task`,
    context.task.raw,
    '',
    `# Relevant modules`,
    ...context.relatedModules.slice(0, 6).map((m) => `- ${m}`),
    '',
    `# Architecture decisions`,
    ...(context.decisions.length
      ? context.decisions.map((d) => `• ${d.title}`)
      : ['• (none)']),
    '',
    `# Warnings`,
    ...(context.warnings.length ? context.warnings.map((w) => `- ${w}`) : ['- None']),
  ];
  if (plan?.steps.length) {
    lines.push('', `# Approach`);
    for (const s of plan.steps) {
      lines.push(`${s.order}. ${s.title} - ${s.detail}`);
    }
  }
  const prompt = `${lines.join('\n').trim()}\n`;
  return {
    prompt,
    markdown: prompt,
    context,
    plan,
    compiled: {
      prompt,
      mode: context.mode === 'architect' || context.mode === 'debug' ? 'deep' : context.mode === 'fast' ? 'minimal' : 'standard',
      profile: {
        mode: context.mode === 'architect' || context.mode === 'debug' ? 'deep' : context.mode === 'fast' ? 'minimal' : 'standard',
        tokenBudget: 1200,
        debug: context.mode === 'debug',
        retrieveLimit: 12,
        includeHints: context.mode !== 'fast',
        includePlan: Boolean(plan),
        includeRisks: false,
      },
      metrics: {
        mode: 'standard',
        tokenBudget: 1200,
        knowledgeSearched: 0,
        knowledgeSelected: 0,
        knowledgeDiscarded: 0,
        compressionRatio: 0,
        promptTokens: Math.ceil(prompt.length / 4),
        estimatedTokensRemoved: 0,
        estimatedContextReduction: 0,
        preparationTimeMs: 0,
        kindNotes: {},
      },
      inclusions: [],
      exclusions: [],
    },
  };
}
