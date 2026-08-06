import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

/**
 * Prepare a coding task via Brain Compression Engine.
 * Default response is a single dense `prompt` + metrics — not the raw Brain.
 * Pass mode=debug or set NEURON_DEBUG=1 for the verbose developer dump.
 */
export async function handlePrepareTask(
  runtime: NeuronRuntime,
  args: { projectId?: string; task: string; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    await runtime.workflow.beforeCoding({ task: args.task });
    const report = await runtime.intelligence.prepareTask(args.task, args.mode);
    const compiled = report.compiled;
    const debug = Boolean(compiled.debug);

    const body: Record<string, unknown> = {
      prompt: compiled.prompt,
      /** Alias — older hosts expected `briefing` */
      briefing: compiled.prompt,
      mode: compiled.mode,
      metrics: compiled.metrics,
      hint: 'Compressed Project Brain prompt (Brain Compiler). Use mode=deep for plans/risks; mode=debug or NEURON_DEBUG=1 for internals.',
    };

    if (debug) {
      body['debug'] = {
        agentMode: report.context.mode,
        task: report.context.task,
        relatedModules: report.context.relatedModules,
        decisions: report.context.decisions,
        warnings: report.context.warnings,
        plan: report.plan,
        recommendations: runtime.intelligence.session.lastRecommendations,
        risks: runtime.intelligence.session.lastRisks,
        inclusions: compiled.inclusions,
        exclusions: compiled.exclusions,
        rawDump: compiled.debug?.rawDump,
        ranked: report.context.ranked,
      };
    }

    return okResult(body);
  } catch (error) {
    return failResult(error);
  }
}
