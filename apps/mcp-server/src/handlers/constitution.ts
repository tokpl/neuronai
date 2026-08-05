import { createProjectConstitutionService } from '@neuron-ai-memory/project-constitution';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

function constitutionService(runtime: NeuronRuntime) {
  const neuronDir = runtime.dataDir
    ? join(runtime.dataDir, '..')
    : join(runtime.cwd, '.neuron');
  return createProjectConstitutionService({
    neuronDir,
    projectId: runtime.project.projectId,
    projectName: runtime.project.name,
    projectRoot: runtime.cwd,
  });
}

async function listMemories(runtime: NeuronRuntime) {
  const ctx = await runtime.engine.getProjectMemoryContext({
    projectId: runtime.project.projectId,
    limit: 200,
    maxTokens: 80_000,
  });
  return ctx.memories;
}

async function collectFileNames(cwd: string): Promise<string[]> {
  const names: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || names.length > 400) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else if (/\.(ts|tsx|js|jsx)$/i.test(e.name)) names.push(p);
    }
  }
  await walk(cwd, 0);
  return names;
}

export async function handleProjectRules(runtime: NeuronRuntime, _args: Record<string, unknown>) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const svc = constitutionService(runtime);
    const result = await svc.getRules();
    return okResult({
      projectId: resolveProjectId(runtime),
      activeCount: result.activeCount,
      suggestedCount: result.suggestedCount,
      markdown: result.markdown,
      rules: result.document.rules,
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleSuggestRule(
  runtime: NeuronRuntime,
  args: { scanFiles?: boolean },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const svc = constitutionService(runtime);
    const memories = await listMemories(runtime);
    const files = args.scanFiles === false ? [] : await collectFileNames(runtime.cwd);
    const result = await svc.suggestRules(memories, files);
    return okResult({
      message:
        'Suggestions only — review with the developer. CRITICAL rules require explicit accept asCritical.',
      patterns: result.patterns,
      suggestions: result.suggestions.map((s) => ({
        id: s.rule.id,
        category: s.rule.category,
        severity: s.rule.severity,
        rule: s.rule.rule,
        confidence: s.rule.confidence,
        evidence: s.evidence,
      })),
      hint: 'Call neuron_generate_cursor_rules after approving rules (CLI: neuron constitution accept <id>).',
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleProjectHealth(runtime: NeuronRuntime, _args: Record<string, unknown>) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const svc = constitutionService(runtime);
    const memories = await listMemories(runtime);
    const report = await svc.projectHealth(memories);
    return okResult(report);
  } catch (error) {
    return failResult(error);
  }
}

export async function handleReviewEvolution(
  runtime: NeuronRuntime,
  args: { commitsSinceReview?: number },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const svc = constitutionService(runtime);
    const files = await collectFileNames(runtime.cwd);
    const review = await svc.reviewEvolution({
      commitsSinceReview: args.commitsSinceReview,
      fileNames: files,
    });
    return okResult(review);
  } catch (error) {
    return failResult(error);
  }
}

export async function handleGenerateCursorRules(
  runtime: NeuronRuntime,
  _args: Record<string, unknown>,
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const svc = constitutionService(runtime);
    const result = await svc.generateCursorRules();
    return okResult({
      path: result.path,
      ruleCount: result.ruleCount,
      preview: result.content.slice(0, 1200),
      note: 'Wrote .cursor/rules/project-architecture.mdc from active constitution rules.',
    });
  } catch (error) {
    return failResult(error);
  }
}

export async function handleAcceptConstitutionRule(
  runtime: NeuronRuntime,
  args: { ruleId: string; asCritical?: boolean },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const svc = constitutionService(runtime);
    const doc = await svc.acceptRule(args.ruleId, Boolean(args.asCritical));
    return okResult({
      accepted: args.ruleId,
      asCritical: Boolean(args.asCritical),
      activeCount: doc.rules.filter((r) => r.status === 'active').length,
    });
  } catch (error) {
    return failResult(error);
  }
}
