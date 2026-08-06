import {
  createBrainCompiler,
  resolvePreparationMode,
} from '@neuronai/brain';
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
  args: { projectId?: string; task: string; files?: string[]; mode?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);

    const prep = resolvePreparationMode(args.mode);
    const taskSize =
      prep.mode === 'deep' ? 'architecture' : prep.mode === 'minimal' ? 'small' : inferTaskSize(args.task);
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

    for (const hit of runtime.brain.query(args.task, profile.maxItems)) {
      const id = `brain:${hit.kind}:${hit.title}`;
      const prev = candidates.get(id)?.score ?? 0;
      candidates.set(id, {
        id,
        title: hit.title,
        content: hit.content,
        score: Math.min(1, Math.max(prev, hit.score)),
        type: hit.kind === 'decision' ? 'architecture_decision' : 'knowledge',
      });
    }

    const selection = budgetMgr.select([...candidates.values()], taskSize);
    const byId = new Map(selection.selected.map((s) => [s.id, s]));

    const decisionCandidates = [...byId.values()]
      .filter((s) => s.type === 'architecture_decision')
      .map((s) => ({
        id: s.id,
        kind: 'decision' as const,
        title: s.title,
        content: s.content,
        score: s.score,
      }));

    const patternCandidates = [...byId.values()]
      .filter((s) => s.type !== 'architecture_decision' && s.type !== 'mistake')
      .map((s) => ({
        id: s.id,
        kind: 'pattern' as const,
        title: s.title,
        content: s.content,
        score: s.score,
      }));

    const mistakes = [...byId.values()]
      .filter((s) => s.type === 'mistake')
      .map((s) => `Known issue: ${s.title}`);

    const warnings = [
      ...context.warnings,
      ...selection.warnings,
      ...mistakes,
    ];

    const compiled = createBrainCompiler().compile({
      task: args.task,
      mode: prep.debug ? 'debug' : prep.mode,
      debug: prep.debug,
      modules: (args.files ?? []).slice(0, 8),
      architectureNotes: selection.selected
        .filter((m) => m.type === 'architecture_decision' || m.type === 'dependency')
        .slice(0, 8)
        .map((m) => m.title),
      decisions: decisionCandidates,
      patterns: patternCandidates,
      warnings,
      hints: prep.includeHints
        ? patternCandidates.slice(0, 4).map((p) => p.title)
        : [],
    });

    const body: Record<string, unknown> = {
      projectId,
      task: args.task,
      files: args.files ?? [],
      prompt: compiled.prompt,
      briefing: compiled.prompt,
      mode: compiled.mode,
      metrics: compiled.metrics,
      omitted: selection.omitted,
      hint: 'Compressed via Brain Compiler. Use neuron_prepare_task for plans (deep) or mode=debug for internals.',
    };

    if (prep.debug) {
      body['debug'] = {
        brain: runtime.brain.status(),
        brainExplain: runtime.brain.explain(),
        inclusions: compiled.inclusions,
        exclusions: compiled.exclusions,
        rawDump: compiled.debug?.rawDump,
        topContext: selection.selected.map((s) => ({
          id: s.id,
          title: s.title,
          score: s.score,
          type: s.type,
        })),
      };
    }

    return okResult(body);
  } catch (error) {
    return failResult(error);
  }
}
