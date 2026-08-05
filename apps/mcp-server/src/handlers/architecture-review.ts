import { join } from 'node:path';

import {
  createArchitectureReviewEngine,
  defaultNeuronModules,
  type ArchitectureScanInput,
  type DependencyEdge,
  type ModuleNode,
} from '@neuron-ai-memory/architecture-review';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadEngine(runtime: NeuronRuntime) {
  const eng = createArchitectureReviewEngine();
  await eng.load(neuronDir(runtime));
  return eng;
}

function parseScanInput(args: {
  modulesJson?: string;
  dependenciesJson?: string;
  label?: string;
  testCoverage?: number;
  documentation?: number;
  security?: number;
  useDefaults?: boolean;
}): ArchitectureScanInput {
  if (args.modulesJson) {
    const modules = JSON.parse(args.modulesJson) as ModuleNode[];
    const dependencies = args.dependenciesJson
      ? (JSON.parse(args.dependenciesJson) as DependencyEdge[])
      : [];
    return {
      modules,
      dependencies,
      label: args.label,
      testCoverage: args.testCoverage,
      documentation: args.documentation,
      security: args.security,
    };
  }
  const defaults = defaultNeuronModules();
  return {
    ...defaults,
    label: args.label ?? 'default-neuron-shape',
    testCoverage: args.testCoverage,
    documentation: args.documentation,
    security: args.security,
  };
}

export async function handleArchitectureScan(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    modulesJson?: string;
    dependenciesJson?: string;
    label?: string;
    testCoverage?: number;
    documentation?: number;
    security?: number;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const scan = eng.scan(parseScanInput(args));
    const reportPath = await eng.writeReport(neuronDir(runtime), scan);
    await eng.save(neuronDir(runtime));
    return okResult({
      score: scan.score,
      issues: scan.issues,
      risks: scan.risks,
      recommendations: scan.recommendations,
      patterns: scan.snapshot.patterns,
      reportPath,
      note: 'Architecture audit only — no automatic code changes.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleDependencyGraph(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    modulesJson?: string;
    dependenciesJson?: string;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const graph = eng.dependencyGraph(parseScanInput(args));
    await eng.save(neuronDir(runtime));
    return okResult({
      ...graph,
      note: 'Dependency map with circular warnings when present.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRefactorPlan(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    modulesJson?: string;
    dependenciesJson?: string;
    label?: string;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const plans = eng.refactorPlan(parseScanInput(args));
    await eng.save(neuronDir(runtime));
    return okResult({
      plans,
      note: 'Suggested steps only — Neuron does not auto-refactor.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleArchitectureScore(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    modulesJson?: string;
    dependenciesJson?: string;
    testCoverage?: number;
    documentation?: number;
    security?: number;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const score = eng.architectureScore(parseScanInput(args));
    await eng.save(neuronDir(runtime));
    return okResult({
      architectureHealth: `${score.score}/100`,
      score,
      note: 'Composite of coupling, complexity, tests, docs, security.',
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Cursor Architecture Review mode — issues, risks, recommendations. */
export async function handleArchitectureReview(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    modulesJson?: string;
    dependenciesJson?: string;
    label?: string;
    changeSummary?: string;
  },
) {
  try {
    const eng = await loadEngine(runtime);
    const input = parseScanInput({ ...args, label: args.label ?? args.changeSummary });
    const result = eng.review(input);
    const reportPath = await eng.writeReport(neuronDir(runtime), result);
    await eng.save(neuronDir(runtime));
    return okResult({
      issues: result.issues,
      risks: result.risks,
      recommendations: result.recommendations,
      score: result.score,
      plans: result.plans.slice(0, 10),
      reportPath,
      changeSummary: args.changeSummary ?? null,
      note: 'Review this refactor — advisory only, no mass edits.',
    });
  } catch (e) {
    return failResult(e);
  }
}
