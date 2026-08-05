import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createProjectBrainBootstrap } from '@neuron-ai-memory/project-scanner';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

export async function handleScanProject(
  runtime: NeuronRuntime,
  args: { mode?: 'fast' | 'deep' | 'architecture' | 'update' },
) {
  try {
    const mode = args.mode ?? 'fast';
    const report = await createProjectBrainBootstrap().scan({
      root: runtime.cwd,
      mode,
      projectName: runtime.project.name,
    });
    return okResult({
      mode: report.mode,
      projectName: report.projectName,
      modules: report.modules,
      services: report.services,
      dependencies: report.dependencies,
      memoriesCreated: report.memoriesCreated,
      relationships: report.relationships,
      rulesSuggested: report.rulesSuggested,
      stack: report.stack,
      markdown: report.markdown,
      note: 'Constitution is suggested only — not auto-activated.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleProjectMap(runtime: NeuronRuntime, _args: Record<string, unknown>) {
  try {
    const dir = neuronDir(runtime);
    let architectureMarkdown = '';
    try {
      architectureMarkdown = await readFile(join(dir, 'architecture.md'), 'utf8');
    } catch {
      const report = await createProjectBrainBootstrap().scan({
        root: runtime.cwd,
        mode: 'architecture',
        projectName: runtime.project.name,
      });
      architectureMarkdown = report.architectureMarkdown;
    }

    let scanMemories: unknown = null;
    try {
      scanMemories = JSON.parse(await readFile(join(dir, 'scan-memories.json'), 'utf8'));
    } catch {
      scanMemories = null;
    }

    let knowledgeGraph: unknown = null;
    try {
      const map = await runtime.projectIntelligence.projectMap(
        runtime.project.projectId,
        runtime.project.name,
      );
      knowledgeGraph = {
        stats: map.stats,
        topNodes: map.topNodes.slice(0, 15),
        exportPreview: {
          nodes: map.export.nodes.length,
          edges: map.export.edges.length,
        },
      };
      await runtime.projectIntelligence.persistVisualization(
        runtime.dataDir ?? join(runtime.cwd, '.neuron', 'data'),
        runtime.project.projectId,
        runtime.project.name,
      );
    } catch {
      knowledgeGraph = null;
    }

    return okResult({
      architectureMarkdown,
      scanMemories,
      knowledgeGraph,
      paths: {
        architecture: join(dir, 'architecture.md'),
        report: join(dir, 'project-report.md'),
        constitution: join(dir, 'constitution.md'),
        graph: join(runtime.dataDir ?? join(runtime.cwd, '.neuron', 'data'), 'graph.json'),
      },
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRefreshBrain(
  runtime: NeuronRuntime,
  _args: Record<string, unknown>,
) {
  try {
    const report = await createProjectBrainBootstrap().scan({
      root: runtime.cwd,
      mode: 'update',
      projectName: runtime.project.name,
    });
    return okResult({
      refreshed: true,
      mode: 'update',
      memoriesCreated: report.memoriesCreated,
      relationships: report.relationships,
      markdown: report.markdown,
    });
  } catch (e) {
    return failResult(e);
  }
}
