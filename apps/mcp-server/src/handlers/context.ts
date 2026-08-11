import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { AFTER_CODING_REMINDER } from './after-coding-reminder.js';
import { CONTEXT_PRESENT } from './context-present.js';

/**
 * The only context tool. Retrieval ranks, the compiler compresses, and the
 * agent receives one markdown document — no briefing/markdown/plan twins.
 *
 * Structured fields (files, modules, rules, metrics, contribution) help the host;
 * the `context` string is what should go into the model prompt.
 * `afterCoding` reminds the agent to close the remember loop after durable work.
 * `contribution` + `present.footer` tell the agent what to show at end of reply.
 */
export async function handleContext(
  runtime: McpRuntime,
  args: { task: string; mode?: string; files?: string[] },
) {
  try {
    const prepared = runtime.neuron.context({
      task: args.task,
      mode: args.mode,
      modules: args.files,
    });

    const eff = prepared.efficiency;
    const contrib = prepared.contribution;

    return okResult({
      context: prepared.context,
      mode: prepared.mode,
      intent: prepared.intent,
      afterCoding: AFTER_CODING_REMINDER,
      contribution: {
        summary: contrib.summary,
        lines: contrib.lines,
        brainCompressionTokens: contrib.brainCompressionTokens,
        contextTokens: contrib.contextTokens,
        budgetTokens: contrib.budgetTokens,
        memoriesUsed: contrib.memoriesUsed,
        memoriesSkipped: contrib.memoriesSkipped,
        memoriesInBrain: contrib.memoriesInBrain,
        pathsSuggested: contrib.pathsSuggested,
        rulesApplied: contrib.rulesApplied,
        compressionRatio: contrib.compressionRatio,
        recommendationPath: contrib.recommendationPath,
        rediscoveryTokensSimulated: contrib.rediscoveryTokensSimulated,
        label: contrib.label,
      },
      present: CONTEXT_PRESENT,
      recommendation: prepared.recommendation
        ? {
            path: prepared.recommendation.path,
            name: prepared.recommendation.name,
            reason: prepared.recommendation.reason,
            related: prepared.recommendation.related,
            symbol: prepared.recommendation.symbol,
            flow: prepared.recommendation.flow,
            dependencies: prepared.recommendation.dependencies,
            tests: prepared.recommendation.tests,
          }
        : undefined,
      relevantFiles: prepared.relevantFiles.map((f) => ({
        name: f.name,
        path: f.path,
        kind: f.kind,
        purpose: f.purpose,
        module: f.module,
        why: f.why,
      })),
      relevantModules: prepared.relevantModules.map((f) => ({
        name: f.name,
        path: f.path,
        purpose: f.purpose,
        why: f.why,
      })),
      relevantRules: prepared.relevantRules,
      flow: prepared.flow,
      metrics: {
        contextTokens: eff.contextTokens,
        budgetTokens: eff.budgetTokens,
        corpusTokens: eff.corpusTokens,
        itemsSelected: eff.itemsSelected,
        itemsDiscarded: eff.itemsDiscarded,
        estimatedTokensSaved: eff.estimatedTokensSaved,
        compressionRatio: eff.compressionRatio,
        baseline: eff.baseline,
        retrievalMs: eff.retrievalMs,
        estimatedRediscoveryAvoided: eff.estimatedRediscoveryAvoided,
        rediscoveryBaseline: eff.rediscoveryBaseline,
      },
    });
  } catch (error) {
    return failResult(error);
  }
}
