import { join } from 'node:path';

import { createWorkflowIntelligence } from '@neuron-ai-memory/workflow-intelligence';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadWf(runtime: NeuronRuntime) {
  const wf = createWorkflowIntelligence();
  await wf.load(neuronDir(runtime));
  return wf;
}

function ensureSession(
  wf: ReturnType<typeof createWorkflowIntelligence>,
  runtime: NeuronRuntime,
  area?: string,
) {
  if (wf.resume().activeSession) return;
  wf.startSession({
    project: runtime.project.name,
    activeArea: area ?? 'Core',
  });
}

export async function handleResume(
  runtime: NeuronRuntime,
  args: { pendingDecisions?: string[]; activeArea?: string },
) {
  try {
    const wf = await loadWf(runtime);
    if (!wf.resume().activeSession && args.activeArea) {
      wf.startSession({
        project: runtime.project.name,
        activeArea: args.activeArea,
      });
    }
    const packet = wf.resumeContext(args.pendingDecisions);
    await wf.save(neuronDir(runtime));
    return okResult(packet);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleResumeContext(
  runtime: NeuronRuntime,
  args: { pendingDecisions?: string[]; activeArea?: string },
) {
  return handleResume(runtime, args);
}

export async function handleSessionSummary(
  runtime: NeuronRuntime,
  args: {
    summary?: string;
    close?: boolean;
    activeArea?: string;
    relatedFiles?: string[];
    unfinishedWork?: string[];
    decisions?: string[];
    branch?: string;
  },
) {
  try {
    const wf = await loadWf(runtime);
    ensureSession(wf, runtime, args.activeArea);
    if (args.activeArea || args.relatedFiles || args.unfinishedWork || args.branch || args.decisions) {
      try {
        wf.updateActiveSession({
          activeArea: args.activeArea,
          relatedFiles: args.relatedFiles,
          unfinishedWork: args.unfinishedWork,
          decisions: args.decisions,
          branch: args.branch,
        });
      } catch {
        ensureSession(wf, runtime, args.activeArea);
      }
    }
    if (args.close && args.summary) {
      const closed = wf.closeSession(args.summary);
      const path = await wf.writeWorkSummary(neuronDir(runtime), closed.markdown);
      await wf.save(neuronDir(runtime));
      return okResult({ ...closed, path });
    }
    const result = wf.sessionSummary();
    const path = await wf.writeWorkSummary(neuronDir(runtime), result.markdown);
    await wf.save(neuronDir(runtime));
    return okResult({ ...result, path });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleCurrentFocus(
  runtime: NeuronRuntime,
  args: {
    area?: string;
    modules?: string[];
    relatedFiles?: string[];
  },
) {
  try {
    const wf = await loadWf(runtime);
    if (args.area) {
      const focus = wf.setFocus(args.area, args.modules, args.relatedFiles);
      await wf.save(neuronDir(runtime));
      return okResult({ focus });
    }
    let focus = wf.currentFocus();
    if (!focus) {
      ensureSession(wf, runtime, 'Core');
      focus = wf.currentFocus();
    }
    return okResult({ focus, flow: wf.projectFlowMetrics() });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleHandoff(
  runtime: NeuronRuntime,
  args: { risks?: string[]; decisions?: string[]; persist?: boolean },
) {
  try {
    const wf = await loadWf(runtime);
    const handoff = wf.handoff({ risks: args.risks, decisions: args.decisions });
    let path: string | undefined;
    if (args.persist !== false) {
      path = await wf.writeHandoff(neuronDir(runtime), handoff.markdown);
    }
    await wf.save(neuronDir(runtime));
    return okResult({ handoff, path });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleTaskContext(
  runtime: NeuronRuntime,
  args: {
    query: string;
    title?: string;
    percentComplete?: number;
    completed?: string[];
    remaining?: string[];
    relatedDecisions?: string[];
    upsert?: boolean;
  },
) {
  try {
    const wf = await loadWf(runtime);
    if (args.upsert || args.title) {
      wf.upsertTask({
        title: args.title ?? args.query,
        percentComplete: args.percentComplete,
        completed: args.completed,
        remaining: args.remaining,
        relatedDecisions: args.relatedDecisions,
      });
    }
    const ctx = wf.taskContext(args.query);
    await wf.save(neuronDir(runtime));
    return okResult(ctx);
  } catch (e) {
    return failResult(e);
  }
}
