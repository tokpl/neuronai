import { join } from 'node:path';

import { createGitEvolutionLinker } from '@neuron-ai-memory/knowledge-graph';
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

export async function handleGitContext(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    query: string;
    commit?: string;
    message?: string;
    author?: string;
    filesChanged?: string[];
    relatedDecisions?: string[];
    relatedIncidents?: string[];
  },
) {
  try {
    const wf = await loadWf(runtime);
    if (args.commit && args.message) {
      wf.ingestGitCommit({
        commit: args.commit,
        message: args.message,
        author: args.author,
        filesChanged: args.filesChanged,
        relatedDecisions: args.relatedDecisions,
        relatedIncidents: args.relatedIncidents,
      });
      await wf.save(neuronDir(runtime));
    }
    return okResult(wf.gitContext(args.query));
  } catch (e) {
    return failResult(e);
  }
}

export async function handleChangeHistory(
  runtime: NeuronRuntime,
  args: { projectId?: string; module: string },
) {
  try {
    const wf = await loadWf(runtime);
    return okResult(wf.changeHistory(args.module));
  } catch (e) {
    return failResult(e);
  }
}

export async function handleArchitectureEvolution(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    before?: string;
    after?: string;
    commit?: string;
    relatedDecisions?: string[];
  },
) {
  try {
    const wf = await loadWf(runtime);
    if (args.before && args.after) {
      wf.getGitIntelligence().evolution.recordManual({
        before: args.before,
        after: args.after,
        commit: args.commit,
        relatedDecisions: args.relatedDecisions,
      });
      await wf.save(neuronDir(runtime));
    }
    const evo = wf.architectureEvolution();
    const linker = createGitEvolutionLinker();
    const graphLinks = linker.toGraphLinks(evo.transitions);
    return okResult({
      ...evo,
      graphLinks,
      note: 'Architecture evolution — git is a history source, not a host.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRegressionCheck(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    commit: string;
    message: string;
    filesChanged?: string[];
    knownProblemCommits?: Array<{ commit: string; problem: string; files?: string[] }>;
  },
) {
  try {
    const wf = await loadWf(runtime);
    const result = wf.regressionCheck({
      commit: args.commit,
      message: args.message,
      filesChanged: args.filesChanged,
      knownProblemCommits: args.knownProblemCommits,
    });
    await wf.save(neuronDir(runtime));
    return okResult({
      ...result,
      note: 'Regression similarity check — advisory only.',
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Cursor: Why is this code like this? */
export async function handleHistoryContext(
  runtime: NeuronRuntime,
  args: { projectId?: string; question: string },
) {
  try {
    const wf = await loadWf(runtime);
    return okResult(wf.historyContext(args.question));
  } catch (e) {
    return failResult(e);
  }
}
