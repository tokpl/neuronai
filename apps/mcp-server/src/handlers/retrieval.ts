import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createRetrievalEngine } from '@neuron-ai-memory/retrieval-engine';
import { createProjectConstitutionService } from '@neuron-ai-memory/project-constitution';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

async function listMemories(runtime: NeuronRuntime) {
  const ctx = await runtime.engine.getProjectMemoryContext({
    projectId: runtime.project.projectId,
    limit: 500,
    maxTokens: 200_000,
  });
  return ctx.memories;
}

async function collectFileNames(cwd: string): Promise<string[]> {
  const names: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || names.length > 500) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (['node_modules', '.git', 'dist', '.neuron'].includes(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else if (/\.(ts|tsx|js|jsx)$/i.test(e.name)) names.push(e.name);
    }
  }
  await walk(cwd, 0);
  return names;
}

async function loadConstitutionRules(runtime: NeuronRuntime): Promise<string[]> {
  try {
    const neuronDir = runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
    const svc = createProjectConstitutionService({
      neuronDir,
      projectId: runtime.project.projectId,
      projectName: runtime.project.name,
      projectRoot: runtime.cwd,
    });
    const doc = await svc.load();
    return doc.rules.filter((r) => r.status === 'active').map((r) => r.rule);
  } catch {
    return [];
  }
}

async function buildInput(runtime: NeuronRuntime, task: string, agentMode?: string) {
  const memories = await listMemories(runtime);
  const fileNames = await collectFileNames(runtime.cwd);
  const constitutionRules = await loadConstitutionRules(runtime);
  const graphModules = [
    ...new Set(
      memories
        .flatMap((m) => m.tags)
        .concat(
          memories
            .map((m) => m.title)
            .filter((t) => /service|module|api|payment|auth|db/i.test(t)),
        ),
    ),
  ].slice(0, 40);

  return {
    task,
    memories,
    fileNames,
    constitutionRules,
    graphModules,
    agentMode: agentMode as 'fast' | 'standard' | 'architect' | 'debug' | 'refactor' | undefined,
  };
}

export async function handleDeepSearch(
  runtime: NeuronRuntime,
  args: { task: string; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const engine = createRetrievalEngine();
    const input = await buildInput(runtime, args.task, args.mode);
    const result = await engine.retrieve(input);
    return okResult({
      query: result.query,
      selected: result.context.selected.map((h) => ({
        id: h.id,
        source: h.source,
        title: h.title,
        score: h.finalScore,
        content: h.content,
      })),
      conflicts: result.context.conflicts,
      metrics: result.metrics,
      tokenEstimate: result.context.tokenEstimate,
      budget: result.budget,
      cacheHit: result.cacheHit,
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleOptimizeContext(
  runtime: NeuronRuntime,
  args: { task: string; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const engine = createRetrievalEngine();
    const result = await engine.retrieve(await buildInput(runtime, args.task, args.mode));
    return okResult({
      preview: result.context.markdown,
      tokenEstimate: result.context.tokenEstimate,
      tokenBudget: result.budget.maxTokens,
      maxItems: result.budget.maxItems,
      compression: result.compression,
      omitted: result.context.omitted,
      note: 'This is the context that would be sent to the agent (not a dump of all memories).',
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleExplainContext(
  runtime: NeuronRuntime,
  args: { task: string; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const engine = createRetrievalEngine();
    const result = await engine.retrieve(await buildInput(runtime, args.task, args.mode));
    return okResult({
      why: result.context.explanation,
      rankingSample: result.context.selected.slice(0, 8).map((h) => ({
        title: h.title,
        source: h.source,
        finalScore: h.finalScore,
        relevanceScore: h.relevanceScore,
        importanceScore: h.importanceScore,
        freshnessScore: h.freshnessScore,
      })),
      conflicts: result.context.conflicts,
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleArchitectureContext(
  runtime: NeuronRuntime,
  args: { task?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const engine = createRetrievalEngine();
    const task = args.task?.trim() || 'Explain project architecture and key decisions';
    const result = await engine.architectureContext(await buildInput(runtime, task, 'architect'));
    return okResult({
      markdown: result.context.markdown,
      clusters: result.context.clusters,
      decisions: result.context.importantDecisions,
      warnings: result.context.warnings,
      tokenEstimate: result.context.tokenEstimate,
      budget: result.budget,
    });
  } catch (error) {
    return failResult(error);
  }
}
