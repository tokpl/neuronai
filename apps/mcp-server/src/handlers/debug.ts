import { join } from 'node:path';

import { createDebugIntelligence } from '@neuron-ai-memory/debug-intelligence';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function load(runtime: NeuronRuntime) {
  const dbg = createDebugIntelligence();
  await dbg.load(neuronDir(runtime));
  return dbg;
}

async function relatedMemories(runtime: NeuronRuntime, query: string): Promise<string[]> {
  try {
    const hits = await runtime.searchEngine.search({
      projectId: runtime.project.projectId,
      query,
      limit: 8,
    });
    return hits.map((h) => `${h.memory.title}: ${h.memory.content}`);
  } catch {
    return [];
  }
}

export async function handleDebugContext(
  runtime: NeuronRuntime,
  args: {
    query: string;
    errorMessage?: string;
    stackTrace?: string;
    changedFiles?: string[];
  },
) {
  try {
    const dbg = await load(runtime);
    const memories = await relatedMemories(runtime, args.query);
    const decisions = memories.filter((m) => /decision/i.test(m));
    const result = dbg.debugContext({
      query: args.query,
      errorMessage: args.errorMessage,
      stackTrace: args.stackTrace,
      changedFiles: args.changedFiles,
      relatedMemories: memories,
      decisions,
    });
    await dbg.save(neuronDir(runtime));
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleSearchIncidents(
  runtime: NeuronRuntime,
  args: { query: string },
) {
  try {
    const dbg = await load(runtime);
    const incidents = dbg.searchIncidents(args.query);
    return okResult({ incidents, count: incidents.length });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRootCause(
  runtime: NeuronRuntime,
  args: {
    query: string;
    errorMessage?: string;
    stackTrace?: string;
    changedFiles?: string[];
  },
) {
  try {
    const dbg = await load(runtime);
    const memories = await relatedMemories(runtime, args.query);
    const report = dbg.rootCause({
      query: args.query,
      errorMessage: args.errorMessage,
      stackTrace: args.stackTrace,
      changedFiles: args.changedFiles,
      decisions: memories,
    });
    return okResult(report);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleCreateIncident(
  runtime: NeuronRuntime,
  args: {
    title: string;
    description: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    affectedModules?: string[];
    links?: Array<{
      kind: 'file' | 'commit' | 'developer' | 'decision' | 'rule' | 'module';
      ref: string;
    }>;
  },
) {
  try {
    const dbg = await load(runtime);
    const incident = dbg.createIncident({
      title: args.title,
      description: args.description,
      severity: args.severity,
      affectedModules: args.affectedModules,
      links: args.links,
    });
    await dbg.save(neuronDir(runtime));
    return okResult({
      incident,
      note: 'Created as OPEN. Resolve later to store incident memory/lesson.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleIncidentHistory(
  runtime: NeuronRuntime,
  args: { incidentId: string },
) {
  try {
    const dbg = await load(runtime);
    const history = dbg.incidentHistory(args.incidentId);
    return okResult(history);
  } catch (e) {
    return failResult(e);
  }
}
