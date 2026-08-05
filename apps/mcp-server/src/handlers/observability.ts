import { join } from 'node:path';

import { createObservabilityEngine } from '@neuron-ai-memory/observability';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadEngine(runtime: NeuronRuntime) {
  const eng = createObservabilityEngine();
  await eng.load(neuronDir(runtime));
  return eng;
}

export async function handleTraceLast(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const eng = await loadEngine(runtime);
    const explained = eng.explainLast();
    return okResult({
      trace: explained.trace ?? null,
      debugMode: explained.debugMode,
      note: explained.trace
        ? 'Last recorded Neuron operation (redacted).'
        : 'No traces yet — run an operation or neuron debug demo.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleExplainReasoning(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const eng = await loadEngine(runtime);
    const explained = eng.explainLast();
    return okResult({
      reasoningPath: explained.reasoningPath ?? null,
      reasoning: explained.reasoning ?? null,
      decision: explained.decision ?? null,
      confidence:
        explained.trace?.confidence ?? explained.reasoning?.finalConfidence ?? null,
      reportMarkdown: explained.reportMarkdown,
      note: 'Why Neuron suggested this — internal reasoning trace only.',
    });
  } catch (e) {
    return failResult(e);
  }
}

/**
 * Context used by the last traced operation.
 * (Distinct from neuron_debug_context which searches past incidents.)
 */
export async function handleTraceContext(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const eng = await loadEngine(runtime);
    const explained = eng.explainLast();
    return okResult({
      contextSources: explained.trace?.contextSources ?? [],
      memories: explained.memoryUsage?.memories ?? [],
      retrieval: explained.retrieval ?? null,
      note: 'Context used in the last Neuron operation (filtered). Use neuron_debug_context for incident history.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handlePerformanceMetrics(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const eng = await loadEngine(runtime);
    const metrics = eng.performanceMetrics();
    const stored = eng.store.getDocument().metrics[0];
    return okResult({
      live: metrics,
      lastStored: stored ?? null,
      retention: eng.getRetention(),
      note: 'Local performance metrics — no cloud export.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleObservabilityDebug(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    enabled?: boolean;
    retention?: 'disable' | 'temporary' | 'persistent';
    recordDemo?: boolean;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    if (args.enabled !== undefined) {
      eng.setDebugMode(args.enabled);
    }
    if (args.retention) {
      eng.setRetention({ mode: args.retention });
    }
    if (args.recordDemo) {
      eng.recordOperation({
        trace: {
          operation: 'demo explain-last',
          operationKind: 'explain',
          durationMs: 42,
          inputType: 'question',
          outputType: 'trace',
          confidence: 0.9,
          contextSources: ['memory:demo'],
          summary: 'Demo observability trace',
        },
        reasoning: {
          userRequest: 'Why did you suggest this?',
          contextRetrieval: 'Loaded project memories',
          selectedMemories: ['Demo architecture decision'],
          graphTraversal: 'demo → core',
          rulesApplied: ['local-first'],
          modelGeneration: 'offline',
          finalResponse: 'Because the existing module already covers it.',
          finalConfidence: 0.9,
        },
        memories: [
          {
            title: 'Demo architecture decision',
            confidence: 0.95,
            reason: 'Matches the asked module.',
          },
        ],
        decision: {
          recommendation: 'Reuse existing module',
          evidence: ['demo module'],
          confidence: 0.9,
          modules: 1,
        },
      });
    }
    const reportPath = await eng.writeReport(neuronDir(runtime));
    await eng.save(neuronDir(runtime));
    return okResult({
      debugMode: eng.isDebugMode(),
      retention: eng.getRetention(),
      session: eng.isDebugMode() ? eng.debugSessionSummary() : undefined,
      reportPath: reportPath ?? null,
      last: eng.explainLast().trace ?? null,
    });
  } catch (e) {
    return failResult(e);
  }
}
