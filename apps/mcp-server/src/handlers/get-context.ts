import {
  createContextBudgetManager,
  inferTaskSize,
  type BudgetCandidate,
} from '@neuronai/cursor-integration';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

export function resolveProjectId(runtime: NeuronRuntime, projectId?: string): string {
  return projectId?.trim() || runtime.project.projectId;
}

export async function handleGetContext(
  runtime: NeuronRuntime,
  args: { projectId?: string; task: string; files?: string[] },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);

    const taskSize = inferTaskSize(args.task);
    const budgetMgr = createContextBudgetManager();
    const profile = budgetMgr.select([], taskSize).profile;

    const maxTokens = Math.min(runtime.config.memory.contextMaxTokens, profile.maxTokens);

    const context = await runtime.engine.getProjectMemoryContext({
      projectId,
      limit: profile.maxItems * 2,
      maxTokens: maxTokens * 2,
    });

    const search = await runtime.engine.searchMemory({
      projectId,
      query: args.task,
      limit: profile.maxItems * 2,
    });

    const candidates = new Map<string, BudgetCandidate>();
    for (const m of context.memories) {
      candidates.set(m.id, {
        id: m.id,
        title: m.title,
        content: m.content,
        score: m.importanceScore * 0.7 + m.freshnessScore * 0.3,
        type: m.type,
      });
    }
    for (const r of search.results) {
      const prev = candidates.get(r.memory.id)?.score ?? 0;
      candidates.set(r.memory.id, {
        id: r.memory.id,
        title: r.memory.title,
        content: r.memory.content,
        score: Math.min(1, Math.max(prev, r.score)),
        type: r.memory.type,
      });
    }

    const selection = budgetMgr.select([...candidates.values()], taskSize);

    const byId = new Map(selection.selected.map((s) => [s.id, s]));

    const decisions = [...byId.values()]
      .filter((s) => s.type === 'architecture_decision')
      .map((s) => ({
        id: s.id,
        title: s.title,
        content: s.content,
        score: s.score,
      }));

    const mistakes = [...byId.values()]
      .filter((s) => s.type === 'mistake')
      .map((s) => ({
        title: s.title,
        content: s.content,
      }));

    const related = [...byId.values()]
      .filter((s) => s.type !== 'architecture_decision' && s.type !== 'mistake')
      .map((s) => ({
        id: s.id,
        type: s.type ?? 'knowledge',
        title: s.title,
        content: s.content,
        score: s.score,
      }));

    const warnings = [
      ...context.warnings,
      ...selection.warnings,
      ...mistakes.map((m) => `Known issue: ${m.title} - ${m.content}`),
    ];

    return okResult({
      projectId,
      task: args.task,
      files: args.files ?? [],
      taskSize: selection.profile.taskSize,
      tokenBudget: selection.profile.maxTokens,
      briefing: selection.briefing,
      omitted: selection.omitted,
      decisions,
      relatedMemories: related,
      architectureNotes: selection.selected
        .filter((m) => m.type === 'architecture_decision' || m.type === 'dependency')
        .slice(0, 8)
        .map((m) => ({ title: m.title, content: m.content })),
      knownIssues: mistakes,
      warnings,
      tokenEstimate: selection.tokenEstimate,
      hint: 'Top-ranked context only (Context Budget Manager). Use neuron_search_memory for more.',
      // keep selectedHits for debugging / hosts that want raw ranked list
      topContext: selection.selected.map((s) => ({
        id: s.id,
        title: s.title,
        score: s.score,
        type: s.type,
      })),
    });
  } catch (error) {
    return failResult(error);
  }
}
