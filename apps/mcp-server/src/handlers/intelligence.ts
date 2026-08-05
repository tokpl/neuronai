import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handlePrepareTask(
  runtime: NeuronRuntime,
  args: { projectId?: string; task: string; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    await runtime.workflow.beforeCoding({ task: args.task });
    const report = await runtime.intelligence.prepareTask(args.task, args.mode);
    return okResult({
      mode: report.context.mode,
      task: report.context.task,
      briefing: report.context.briefing,
      markdown: report.markdown,
      relatedModules: report.context.relatedModules,
      decisions: report.context.decisions,
      warnings: report.context.warnings,
      plan: report.plan,
      recommendations: runtime.intelligence.session.lastRecommendations,
      risks: runtime.intelligence.session.lastRisks,
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleReviewArchitecture(
  runtime: NeuronRuntime,
  args: { projectId?: string; changeDescription: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const review = await runtime.intelligence.reviewArchitecture(args.changeDescription);
    return okResult({
      score: review.score,
      issues: review.issues,
      recommendations: review.recommendations,
      alignedDecisions: review.alignedDecisions,
      conflicts: review.conflicts,
      risk: review.risk,
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleAnalyzeImpact(
  runtime: NeuronRuntime,
  args: { projectId?: string; target: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const result = await runtime.intelligence.analyzeImpact(args.target);
    return okResult(result);
  } catch (error) {
    return failResult(error);
  }
}

export async function handleGeneratePlan(
  runtime: NeuronRuntime,
  args: { projectId?: string; featureRequest: string; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const plan = await runtime.intelligence.generatePlan(args.featureRequest, args.mode);
    return okResult({ plan });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleProjectQuestion(
  runtime: NeuronRuntime,
  args: { projectId?: string; question: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const answer = await runtime.intelligence.projectQuestion(args.question);
    return okResult(answer);
  } catch (error) {
    return failResult(error);
  }
}

export async function handleCompleteTask(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    task: string;
    outcome: 'success' | 'partial' | 'failed';
    summary?: string;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const result = await runtime.intelligence.completeTask({
      task: args.task,
      outcome: args.outcome,
      summary: args.summary,
    });
    return okResult(result);
  } catch (error) {
    return failResult(error);
  }
}
