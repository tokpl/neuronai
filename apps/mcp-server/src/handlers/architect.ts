import { createArchitectModeEngine } from '@neuron-ai-memory/architect-mode';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

async function loadMemoryContext(runtime: NeuronRuntime) {
  try {
    const ctx = await runtime.engine.getProjectMemoryContext({
      projectId: runtime.project.projectId,
      limit: 80,
      maxTokens: 24_000,
    });
    const decisions = ctx.memories
      .filter((m) => m.type === 'architecture_decision')
      .map((m) => `${m.title}: ${m.content}`);
    const patterns = ctx.memories
      .filter((m) => m.type === 'pattern')
      .map((m) => `${m.title}: ${m.content}`);
    const mistakes = ctx.memories
      .filter((m) => m.type === 'mistake')
      .map((m) => `${m.title}: ${m.content}`);
    const modules = [
      ...new Set(ctx.memories.flatMap((m) => m.tags).concat(runtime.project.stack)),
    ].slice(0, 40);
    return { decisions, patterns, mistakes, modules, constitution: [] as string[] };
  } catch {
    return {
      decisions: [] as string[],
      patterns: [] as string[],
      mistakes: [] as string[],
      modules: runtime.project.stack,
      constitution: [] as string[],
    };
  }
}

export async function handleArchitect(
  runtime: NeuronRuntime,
  args: { request: string; mode?: 'NORMAL' | 'ARCHITECT' | 'REVIEW' | 'DEBUG' },
) {
  try {
    const engine = createArchitectModeEngine();
    const memory = await loadMemoryContext(runtime);
    const report = engine.run({
      request: args.request,
      mode: args.mode ?? 'ARCHITECT',
      memory,
    });
    return okResult({
      mode: report.mode,
      feature: report.requirement.feature,
      complexity: report.requirement.complexity,
      risk: report.risk.level,
      recommendation: report.proposal.recommendation,
      planSteps: report.plan.steps,
      adr: report.adr,
      markdown: report.markdown,
      note: 'Proposal only — Neuron does not write application code or auto-approve ADRs.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleCreatePlan(
  runtime: NeuronRuntime,
  args: { request: string },
) {
  try {
    const engine = createArchitectModeEngine();
    const memory = await loadMemoryContext(runtime);
    const plan = engine.createPlan(args.request, memory);
    return okResult({ plan, note: 'Outline only — no code generation.' });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleReviewChange(
  runtime: NeuronRuntime,
  args: {
    request: string;
    changeSummary?: string;
    changedPaths?: string[];
    scoreBefore?: number;
  },
) {
  try {
    const engine = createArchitectModeEngine();
    const memory = await loadMemoryContext(runtime);
    const report = engine.reviewChange({
      request: args.request,
      changeSummary: args.changeSummary,
      changedPaths: args.changedPaths,
      scoreBefore: args.scoreBefore,
      memory,
    });
    return okResult({
      review: report.review,
      score: report.score,
      markdown: report.markdown,
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleCompareArchitecture(
  runtime: NeuronRuntime,
  args: {
    request: string;
    changeSummary?: string;
    changedPaths?: string[];
    scoreBefore?: number;
  },
) {
  try {
    const engine = createArchitectModeEngine();
    const memory = await loadMemoryContext(runtime);
    const score = engine.compareArchitecture({
      request: args.request,
      changeSummary: args.changeSummary,
      changedPaths: args.changedPaths,
      scoreBefore: args.scoreBefore ?? 72,
      memory,
      mode: 'REVIEW',
    });
    return okResult({ score });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleGenerateAdr(
  runtime: NeuronRuntime,
  args: { request: string },
) {
  try {
    const engine = createArchitectModeEngine();
    const memory = await loadMemoryContext(runtime);
    const adr = engine.generateAdr({ request: args.request, memory, mode: 'ARCHITECT' });
    return okResult({
      adr,
      note: 'Status is Pending approval — human must accept.',
    });
  } catch (e) {
    return failResult(e);
  }
}
