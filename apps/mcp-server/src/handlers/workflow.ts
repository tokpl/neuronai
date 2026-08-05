import { createNeuronEvent, type NeuronEventType } from '@neuron-ai-memory/agent-workflow';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { handleGetContext, resolveProjectId } from './get-context.js';

/**
 * Agent coding-lifecycle workflow (start / ingest / after / suggest).
 * Separate from developer work-context intelligence (see work-context.ts).
 */
export async function handleStartTask(
  runtime: NeuronRuntime,
  args: { projectId?: string; task: string; files?: string[] },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const session = await runtime.workflow.beforeCoding({
      task: args.task,
      files: args.files,
    });
    const context = await handleGetContext(runtime, {
      projectId: args.projectId,
      task: args.task,
      files: args.files,
    });
    return okResult({
      session,
      privacyMode: runtime.privacyMode,
      context: context.isError
        ? null
        : JSON.parse(context.content[0]!.text),
      note: 'Workflow session started — suggestions respect privacy mode.',
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleIngestEvent(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    type: NeuronEventType;
    payload?: Record<string, unknown>;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);
    const event = createNeuronEvent({
      type: args.type,
      projectId,
      source: 'agent',
      payload: args.payload ?? {},
    });
    await runtime.workflow.ingest(event);
    return okResult({ event, note: 'Event ingested into workflow bus.' });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleAfterTask(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    task?: string;
    summary?: string;
    diff?: string;
    files?: string[];
    commitMessage?: string;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const result = await runtime.workflow.afterCoding(args);
    if (result.persisted && runtime.persist) await runtime.persist();
    return okResult({
      ok: true,
      analysis: result.analysis,
      suggestion: result.suggestion,
      quality: result.quality,
      persisted: result.persisted,
      promptText: result.promptText,
      privacyMode: runtime.privacyMode,
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleSuggestFromChanges(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    diff?: string;
    files?: string[];
    commitMessage?: string;
    task?: string;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const result = await runtime.workflow.afterCoding({
      task: args.task,
      diff: args.diff,
      files: args.files,
      commitMessage: args.commitMessage,
    });
    if (result.persisted && runtime.persist) await runtime.persist();
    return okResult({
      ok: true,
      analysis: result.analysis,
      suggestion: result.suggestion,
      quality: result.quality,
      persisted: result.persisted,
      promptText: result.promptText,
    });
  } catch (error) {
    return failResult(error);
  }
}
