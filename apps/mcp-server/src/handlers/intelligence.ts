import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handlePrepareTask(
  runtime: NeuronRuntime,
  args: { projectId?: string; task: string; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    await runtime.workflow.beforeCoding({ task: args.task });
    const report = await runtime.intelligence.prepareTask(args.task, args.mode);
    return okResult({
      mode: report.context.mode,
      task: report.context.task,
      briefing: report.context.briefing,
      markdown: report.markdown,
      relatedModules: report.context.relatedModules,
      decisions: report.context.decisions,
      warnings: report.context.warnings,
      plan: report.plan,
      recommendations: runtime.intelligence.session.lastRecommendations,
      risks: runtime.intelligence.session.lastRisks,
    });
  } catch (error) {
    return failResult(error);
  }
}
