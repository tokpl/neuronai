import { join } from 'node:path';

import { createAiRuntime } from '@neuron-ai-memory/ai-runtime';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadRuntime(runtime: NeuronRuntime) {
  const ai = createAiRuntime();
  await ai.load(neuronDir(runtime));
  return ai;
}

export async function handleAiStatus(
  runtime: NeuronRuntime,
  args: { projectId?: string },
) {
  try {
    resolveProjectId(runtime, args.projectId);
    const ai = await loadRuntime(runtime);
    const status = await ai.status();
    return okResult(status);
  } catch (error) {
    return failResult(error);
  }
}

export async function handleSelectModel(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    task: string;
    text?: string;
    pathHint?: string;
  },
) {
  try {
    resolveProjectId(runtime, args.projectId);
    const ai = await loadRuntime(runtime);
    const selection = ai.selectModel(args.task, args.text, args.pathHint);
    await ai.save(neuronDir(runtime));
    return okResult(selection);
  } catch (error) {
    return failResult(error);
  }
}

export async function handlePrivacyCheck(
  runtime: NeuronRuntime,
  args: { projectId?: string; text: string; pathHint?: string },
) {
  try {
    resolveProjectId(runtime, args.projectId);
    const ai = await loadRuntime(runtime);
    return okResult(ai.privacyCheck(args.text, args.pathHint));
  } catch (error) {
    return failResult(error);
  }
}

export async function handleModelHealth(
  runtime: NeuronRuntime,
  args: { projectId?: string },
) {
  try {
    resolveProjectId(runtime, args.projectId);
    const ai = await loadRuntime(runtime);
    const health = await ai.modelHealth();
    return okResult({ health, available: ai.availableModels() });
  } catch (error) {
    return failResult(error);
  }
}

/** Alias surfaces requested for Cursor */
export async function handleAvailableModels(
  runtime: NeuronRuntime,
  args: { projectId?: string },
) {
  try {
    resolveProjectId(runtime, args.projectId);
    const ai = await loadRuntime(runtime);
    return okResult({ models: ai.availableModels(), config: ai.getConfig() });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleBestModelForTask(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    task: string;
    text?: string;
    pathHint?: string;
  },
) {
  return handleSelectModel(runtime, args);
}
