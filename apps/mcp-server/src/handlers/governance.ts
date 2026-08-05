import { join } from 'node:path';

import { createMemoryGovernanceEngine } from '@neuron-ai-memory/memory-governance';
import { createProjectConstitutionService } from '@neuron-ai-memory/project-constitution';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function listMemories(runtime: NeuronRuntime) {
  const ctx = await runtime.engine.getProjectMemoryContext({
    projectId: runtime.project.projectId,
    limit: 500,
    maxTokens: 200_000,
  });
  return ctx.memories;
}

async function collectCodeSignals(cwd: string): Promise<string[]> {
  const names: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || names.length > 800) return;
    let entries;
    try {
      entries = await (await import('node:fs/promises')).readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (['node_modules', '.git', 'dist', '.neuron'].includes(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else names.push(e.name);
    }
  }
  await walk(cwd, 0);
  return names;
}

async function loadRules(runtime: NeuronRuntime): Promise<string[]> {
  try {
    const svc = createProjectConstitutionService({
      neuronDir: neuronDir(runtime),
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

async function scan(runtime: NeuronRuntime) {
  const engine = createMemoryGovernanceEngine();
  const memories = await listMemories(runtime);
  const codeSignals = await collectCodeSignals(runtime.cwd);
  const rules = await loadRules(runtime);
  return { engine, report: engine.scan({ memories, codeSignals, rules }), memories };
}

export async function handleMemoryHealth(runtime: NeuronRuntime, _args: Record<string, unknown>) {
  try {
    const { engine, report } = await scan(runtime);
    const path = await engine.writeHealthReport(neuronDir(runtime), report);
    return okResult({
      overallScore: report.overallScore,
      memoryCount: report.memoryCount,
      healthyCount: report.healthyCount,
      totals: report.totals,
      problems: report.problems,
      recommendations: report.recommendations,
      markdown: report.markdown,
      reportPath: path,
      maintenance: engine.maintenancePlan('weekly'),
      note: 'Neuron proposes only — never permanently deletes. Context freshness checked before answers.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleReviewQueue(runtime: NeuronRuntime, args: { limit?: number }) {
  return handleMemoryReview(runtime, args);
}

export async function handleMemoryReview(runtime: NeuronRuntime, args: { limit?: number }) {
  try {
    const { report } = await scan(runtime);
    const limit = args.limit ?? 50;
    return okResult({
      queue: report.reviewQueue.slice(0, limit),
      total: report.reviewQueue.length,
      kinds: {
        conflicts: report.problems.conflicts,
        outdated: report.problems.outdated,
        lowConfidence: report.problems.lowQuality,
      },
      note: 'Review items: conflicts, low confidence, outdated, important changes.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleCleanupSuggestions(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  return handleMemoryCleanup(runtime, args);
}

export async function handleMemoryCleanup(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  try {
    const { engine, memories } = await scan(runtime);
    const result = engine.runCleanup({ memories, codeSignals: await collectCodeSignals(runtime.cwd) });
    const path = await engine.writeHealthReport(neuronDir(runtime), result.report);
    const limit = args.limit ?? 50;
    return okResult({
      operations: result.operations.slice(0, limit),
      suggestions: result.report.cleanupSuggestions.slice(0, limit),
      archiveProposals: result.archiveProposals.slice(0, limit),
      decayAdjustments: result.report.decayAdjustments.slice(0, limit),
      reportPath: path,
      audit: engine.recentAudit(10),
      note: result.note,
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleMemoryConflicts(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  try {
    const { engine, memories } = await scan(runtime);
    const conflicts = engine.memoryConflicts({ memories });
    const limit = args.limit ?? 50;
    return okResult({
      conflicts: conflicts.slice(0, limit),
      total: conflicts.length,
      note: 'Conflicts require resolution — Neuron never auto-picks a winner.',
    });
  } catch (e) {
    return failResult(e);
  }
}
