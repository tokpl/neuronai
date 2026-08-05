import { join } from 'node:path';

import {
  createAssistantModesEngine,
  type ContextNeed,
} from '@neuron-ai-memory/assistant-modes';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadEngine(runtime: NeuronRuntime) {
  const eng = createAssistantModesEngine();
  await eng.load(neuronDir(runtime));
  return eng;
}

export async function handleAvailableModes(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const eng = await loadEngine(runtime);
    const modes = eng.availableModes().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      cursorCommand: m.cursorCommand,
      capabilities: m.enabledCapabilities,
      requiredContext: m.requiredContext,
      suggestedMcpTools: m.suggestedMcpTools,
    }));
    return okResult({
      modes,
      note: 'Specialized developer modes — advisory MCP workflows, not autonomous agents.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleModeContext(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    modeId: string;
    availableContext?: ContextNeed[];
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const ctx = eng.modeContext(args.modeId, args.availableContext ?? []);
    return okResult(ctx);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRunMode(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    query: string;
    modeId?: string;
    availableContext?: ContextNeed[];
    useful?: boolean;
    feedback?: string;
    accuracyHint?: number;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const result = eng.runMode({
      query: args.query,
      modeId: args.modeId,
      availableContext: args.availableContext,
      useful: args.useful,
      feedback: args.feedback,
      accuracyHint: args.accuracyHint,
    });
    await eng.save(neuronDir(runtime));
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}
