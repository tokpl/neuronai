import {
  playbookChecklist,
  writeDeliverGate,
  clearDeliverGate,
  gateBlocksExecute,
  type DeliverPlaybook,
} from '@neuronai/brain';

import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { AFTER_CODING_REMINDER } from './after-coding-reminder.js';
import { buildContextPresent } from './context-present.js';

/**
 * The only context tool. Retrieval ranks, the compiler compresses, and the
 * agent receives one markdown document — no briefing/markdown/plan twins.
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

    const contrib = prepared.contribution;
    const playbook = (prepared.clarify.playbook ?? 'build') as DeliverPlaybook;
    const checklist = playbookChecklist(playbook);

    if (prepared.clarify.questions.length > 0) {
      runtime.pendingClarify = {
        task: args.task,
        prompt: prepared.clarify.askQuestion?.prompt,
        remainingIds: prepared.clarify.questions.map((q) => q.id),
      };
      if (prepared.clarify.gate?.required) {
        await writeDeliverGate(runtime.neuron.brain, {
          reason: prepared.clarify.gate.reason,
          until: prepared.clarify.gate.until,
          questionIds: prepared.clarify.questions.map((q) => q.id),
          task: args.task,
          playbook,
        });
      }
    } else {
      runtime.pendingClarify = null;
      if (prepared.clarify.express || !prepared.clarify.gate?.required) {
        // Express / no gate this turn — clear stale gate only when Brain says proceed
        if (prepared.clarify.express) {
          await clearDeliverGate(runtime.neuron.brain);
        }
      }
    }

    const gateFileActive = await gateBlocksExecute(runtime.neuron.brain);

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
      present: buildContextPresent({
        questions: prepared.clarify.questions,
        askQuestion: prepared.clarify.askQuestion,
        gate: prepared.clarify.gate,
        recommendPrime: prepared.clarify.recommendPrime,
        recommendDeliver:
          prepared.intent === 'ARCHITECTURE' ||
          (prepared.intent === 'MODIFICATION' && prepared.clarify.questions.length > 0) ||
          prepared.clarify.playbook !== 'build',
        playbook: prepared.clarify.playbook,
        express: prepared.clarify.express,
        checklist,
        gateFileActive,
      }),
      clarify: {
        questions: prepared.clarify.questions,
        recommendPrime: prepared.clarify.recommendPrime,
        gate: prepared.clarify.gate,
      },
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
        contextTokens: prepared.efficiency.contextTokens,
        budgetTokens: prepared.efficiency.budgetTokens,
        corpusTokens: prepared.efficiency.corpusTokens,
        itemsSelected: prepared.efficiency.itemsSelected,
        itemsDiscarded: prepared.efficiency.itemsDiscarded,
        estimatedTokensSaved: prepared.efficiency.estimatedTokensSaved,
        compressionRatio: prepared.efficiency.compressionRatio,
        baseline: prepared.efficiency.baseline,
        retrievalMs: prepared.efficiency.retrievalMs,
        estimatedRediscoveryAvoided: prepared.efficiency.estimatedRediscoveryAvoided,
        rediscoveryBaseline: prepared.efficiency.rediscoveryBaseline,
      },
    });
  } catch (error) {
    return failResult(error);
  }
}
