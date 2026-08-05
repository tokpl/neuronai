import { join } from 'node:path';

import { createEvaluationEngine } from '@neuron-ai-memory/evaluation-engine';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadEngine(runtime: NeuronRuntime) {
  const eng = createEvaluationEngine();
  await eng.load(neuronDir(runtime));
  return eng;
}

export async function handleQualityReport(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const eng = await loadEngine(runtime);
    return okResult(eng.qualityReport());
  } catch (e) {
    return failResult(e);
  }
}

export async function handleEvaluateAnswer(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    task: string;
    answer: string;
    expectedKeywords?: string[];
    unexpectedKeywords?: string[];
    knownFacts?: string[];
    knownFiles?: string[];
    knownDecisions?: string[];
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const result = eng.evaluateAnswer({
      task: args.task,
      answer: args.answer,
      expectedKeywords: args.expectedKeywords,
      unexpectedKeywords: args.unexpectedKeywords,
      hallucinationContext:
        args.knownFacts || args.knownFiles || args.knownDecisions
          ? {
              knownFacts: args.knownFacts ?? [],
              knownFiles: args.knownFiles,
              knownDecisions: args.knownDecisions,
            }
          : undefined,
    });
    await eng.save(neuronDir(runtime));
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleMemoryQuality(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    memories?: Array<{
      memoryId: string;
      title: string;
      confidence?: number;
      usageFrequency?: number;
      validationCount?: number;
      ageDays?: number;
    }>;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    let scored = eng.qualityReport().memoryTop;
    if (args.memories?.length) {
      scored = eng.scoreMemories(args.memories);
      await eng.save(neuronDir(runtime));
    } else {
      // Derive lightweight scores from local store if present
      try {
        const memories = runtime.searchEngine
          ? await runtime.searchEngine.search({
              projectId: runtime.project.projectId,
              query: 'architecture decision pattern',
              limit: 20,
            })
          : [];
        if (memories.length) {
          scored = eng.scoreMemories(
            memories.map((h, i) => ({
              memoryId: h.memory.id,
              title: h.memory.title,
              confidence: Math.min(1, (h.memory.importanceScore ?? 50) / 100),
              usageFrequency: Math.max(0, 20 - i),
              validationCount: h.memory.status === 'active' ? 3 : 0,
              ageDays: 30,
            })),
          );
          await eng.save(neuronDir(runtime));
        }
      } catch {
        /* optional */
      }
    }
    return okResult({
      memories: scored,
      note: 'Memory quality metrics only — no private content exported.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleBenchmarkRun(
  runtime: NeuronRuntime,
  args: { projectId?: string; answersJson?: string },
) {
  try {
    const eng = await loadEngine(runtime);
    let answers: Record<string, string> | undefined;
    if (args.answersJson) {
      answers = JSON.parse(args.answersJson) as Record<string, string>;
    }
    const result = await eng.runBenchmark(neuronDir(runtime), answers);
    return okResult({
      overall: result.run.overall,
      cases: result.run.cases,
      regressions: result.regressions,
      evaluationPath: result.path,
      note: 'Memory/quality benchmark — no model training.',
    });
  } catch (e) {
    return failResult(e);
  }
}
