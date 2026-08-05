import { join } from 'node:path';

import { createDecisionEngine } from '@neuron-ai-memory/decision-engine';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadEngine(runtime: NeuronRuntime) {
  const eng = createDecisionEngine();
  await eng.load(neuronDir(runtime));
  return eng;
}

async function gatherContext(runtime: NeuronRuntime, request: string) {
  const memories: string[] = [];
  const decisions: string[] = [];
  const incidents: string[] = [];
  const rules: string[] = [];
  const codeRefs: string[] = [];
  let graphSummary: string | undefined;

  try {
    const hits = await runtime.searchEngine.search({
      projectId: runtime.project.projectId,
      query: request,
      limit: 12,
    });
    for (const h of hits) {
      const line = `${h.memory.title}: ${h.memory.content}`;
      if (h.memory.type === 'architecture_decision') decisions.push(line);
      else if (h.memory.type === 'mistake') incidents.push(line);
      else memories.push(line);
      for (const t of h.memory.tags ?? []) {
        if (/src\/|\.ts|\.tsx|\.js/.test(t)) codeRefs.push(t);
      }
    }
  } catch {
    /* optional */
  }

  try {
    const related = await runtime.intelligence.relatedKnowledge(request, 8);
    if (related.seed) {
      graphSummary = `Graph seed ${related.seed.name}; ${related.nodes.length} related nodes`;
    }
    for (const m of related.memories ?? []) {
      memories.push(`${m.name} [${m.type}]`);
    }
  } catch {
    /* optional */
  }

  try {
    const map = await runtime.intelligence.graphQuery(request);
    if (map && typeof map === 'object' && 'summary' in map && typeof map.summary === 'string') {
      graphSummary = map.summary;
    } else if (map && typeof map === 'object' && 'answer' in map && typeof map.answer === 'string') {
      graphSummary = map.answer;
    }
  } catch {
    /* optional */
  }

  return {
    request,
    memories,
    decisions,
    incidents,
    rules,
    codeRefs,
    graphSummary,
    patterns: memories.filter((m) => /pattern|service|module/i.test(m)).slice(0, 8),
  };
}

export async function handleReason(
  runtime: NeuronRuntime,
  args: { request: string; projectId?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const eng = await loadEngine(runtime);
    const ctx = await gatherContext(runtime, args.request);
    const result = eng.reason(ctx);
    await eng.save(neuronDir(runtime));
    return okResult({
      ...result,
      note: 'Explicit reasoning — advisory only, no autonomous code changes.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRecommend(
  runtime: NeuronRuntime,
  args: { request: string; projectId?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const eng = await loadEngine(runtime);
    const ctx = await gatherContext(runtime, args.request);
    const result = eng.recommend(ctx);
    await eng.save(neuronDir(runtime));
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleDecisionContext(
  runtime: NeuronRuntime,
  args: { request: string; projectId?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const eng = await loadEngine(runtime);
    const ctx = await gatherContext(runtime, args.request);
    const result = eng.decisionContext(ctx);
    await eng.save(neuronDir(runtime));
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleCompareOptions(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    optionA: string;
    optionB: string;
    topic?: string;
    notesA?: string;
    notesB?: string;
    request?: string;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const eng = await loadEngine(runtime);
    const request =
      args.request ?? `Compare ${args.optionA} vs ${args.optionB}${args.topic ? ` for ${args.topic}` : ''}`;
    const ctx = await gatherContext(runtime, request);
    const result = eng.compareOptions(
      {
        a: { name: args.optionA, notes: args.notesA },
        b: { name: args.optionB, notes: args.notesB },
        topic: args.topic,
      },
      ctx,
    );
    await eng.save(neuronDir(runtime));
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleExplainDecision(
  runtime: NeuronRuntime,
  args: { decisionId?: string; projectId?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const eng = await loadEngine(runtime);
    if (!eng.listDecisions().length && !args.decisionId) {
      return okResult({
        note: 'No stored decisions yet — call neuron_reason or neuron_recommend first.',
      });
    }
    const result = eng.explainDecision(args.decisionId);
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}
