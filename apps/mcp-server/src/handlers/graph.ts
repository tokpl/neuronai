import { join } from 'node:path';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

function dataDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ?? join(runtime.cwd, '.neuron', 'data');
}

export async function handleGraphQuery(
  runtime: NeuronRuntime,
  args: { projectId?: string; question: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const map = await runtime.intelligence.graphQuery(args.question);
    return okResult({
      ...map,
      note: 'Graph 2.0 reasoning — local knowledge graph only (no cloud graph).',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleImpactAnalysis(
  runtime: NeuronRuntime,
  args: { projectId?: string; target: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const result = await runtime.intelligence.analyzeImpact(args.target);
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRelatedKnowledge(
  runtime: NeuronRuntime,
  args: { projectId?: string; query: string; limit?: number },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const related = await runtime.intelligence.relatedKnowledge(args.query, args.limit ?? 20);
    return okResult({
      ...related,
      note: 'Related graph knowledge for retrieval / Cursor context.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleGraphProjectMap(
  runtime: NeuronRuntime,
  args: { projectId?: string; persist?: boolean },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const eng = runtime.projectIntelligence;
    let map = await eng.projectMap(runtime.project.projectId, runtime.project.name);
    let path: string | undefined;
    if (args.persist !== false) {
      const written = await eng.persistVisualization(
        dataDir(runtime),
        runtime.project.projectId,
        runtime.project.name,
      );
      path = written.path;
      map = written;
    }
    return okResult({
      graph: map.export,
      stats: map.stats,
      topNodes: map.topNodes,
      path,
      note: 'Local graph.json for visualization — no hosted dashboard.',
    });
  } catch (e) {
    return failResult(e);
  }
}
