import type { MemoryRecord } from '@neuron-ai-memory/types';

import type {
  BrainHealthReport,
  CleanupSuggestion,
  DecayAdjustment,
  MemoryHealthScore,
  ReviewQueueItem,
} from '../types.js';
import { clamp100, nowIso } from '../types.js';

export class BrainHealthReporter {
  build(input: {
    memories: MemoryRecord[];
    scores: MemoryHealthScore[];
    reviewQueue: ReviewQueueItem[];
    cleanupSuggestions: CleanupSuggestion[];
    decayAdjustments?: DecayAdjustment[];
    unusedRules?: number;
  }): BrainHealthReport {
    const active = input.memories.filter((m) => m.status === 'active');
    const archived = input.memories.filter(
      (m) => m.status === 'archived' || m.status === 'superseded',
    );
    const overallScore =
      input.scores.length === 0
        ? 100
        : clamp100(
            input.scores.reduce((s, x) => s + x.healthScore, 0) / input.scores.length,
          );

    const outdated = input.scores.filter((s) => s.lifecycle === 'OUTDATED').length;
    const conflicts = input.scores.filter((s) => s.lifecycle === 'CONFLICTED').length;
    const proposed = input.scores.filter((s) => s.lifecycle === 'PROPOSED').length;
    const conflictSuggestions = input.cleanupSuggestions.filter((c) => c.kind === 'conflict').length;
    const duplicates = input.cleanupSuggestions.filter((c) => c.kind === 'duplicate').length;
    const staleSuggestions = input.cleanupSuggestions.filter((c) => c.kind === 'stale').length;
    const lowQuality = input.scores.filter((s) => s.healthScore < 50).length;
    const unusedRules = input.unusedRules ?? 0;
    const healthyCount = input.scores.filter((s) => s.healthScore >= 70).length;

    const recommendations = buildRecommendations({
      overallScore,
      outdated: Math.max(outdated, staleSuggestions),
      conflicts: Math.max(conflicts, conflictSuggestions),
      duplicates,
      lowQuality,
      queue: input.reviewQueue,
    });

    const report: BrainHealthReport = {
      overallScore,
      memoryCount: active.length,
      healthyCount,
      totals: {
        total: input.memories.length,
        active: active.length,
        archived: archived.length,
        conflicts: Math.max(conflicts, conflictSuggestions),
        outdated: Math.max(outdated, staleSuggestions),
        proposed,
      },
      problems: {
        outdated: Math.max(outdated, staleSuggestions),
        conflicts: Math.max(conflicts, conflictSuggestions),
        duplicates,
        lowQuality,
        unusedRules,
      },
      recommendations,
      scores: input.scores,
      reviewQueue: input.reviewQueue,
      cleanupSuggestions: input.cleanupSuggestions,
      decayAdjustments: input.decayAdjustments ?? [],
      markdown: '',
      generatedAt: nowIso(),
    };
    report.markdown = renderMarkdown(report);
    return report;
  }
}

function buildRecommendations(input: {
  overallScore: number;
  outdated: number;
  conflicts: number;
  duplicates: number;
  lowQuality: number;
  queue: ReviewQueueItem[];
}): string[] {
  const recs: string[] = [];
  if (input.conflicts > 0) {
    recs.push('Resolve architecture conflicts (supersede older decisions after review).');
  }
  if (input.duplicates > 0) {
    recs.push('Merge semantic duplicate memories to reduce agent noise.');
  }
  if (input.outdated > 0) {
    recs.push('Review outdated memories after project changes (archive, do not delete).');
  }
  const auth = input.queue.find((q) => /auth/i.test(q.title) || /auth/i.test(q.reason));
  if (auth) recs.push('Review authentication architecture decisions.');
  if (input.lowQuality > 0) {
    recs.push(`Inspect ${input.lowQuality} low-health memories (score < 50).`);
  }
  if (input.overallScore >= 85 && recs.length === 0) {
    recs.push('Brain looks healthy — keep validating high-impact decisions on schedule.');
  }
  return recs.slice(0, 8);
}

function renderMarkdown(r: BrainHealthReport): string {
  return [
    '# Project Memory Health',
    '',
    `**${r.overallScore}/100** · ${r.healthyCount}/${r.memoryCount} active memories healthy (≥70)`,
    '',
    '## Totals',
    `- Total memories: ${r.totals.total}`,
    `- Active: ${r.totals.active}`,
    `- Archived: ${r.totals.archived}`,
    `- Conflicts: ${r.totals.conflicts}`,
    `- Outdated: ${r.totals.outdated}`,
    `- Proposed: ${r.totals.proposed}`,
    '',
    '## Problems',
    `- ${r.problems.outdated} outdated / stale signals`,
    `- ${r.problems.conflicts} conflicts`,
    `- ${r.problems.duplicates} duplicates`,
    `- ${r.problems.lowQuality} low-quality memories`,
    `- ${r.problems.unusedRules} unused rules`,
    '',
    '## Recommendations',
    ...(r.recommendations.length ? r.recommendations.map((x) => `- ${x}`) : ['- (none)']),
    '',
    '## Review queue (top)',
    ...r.reviewQueue.slice(0, 10).map((q) => `- [${q.priority}] ${q.title}: ${q.reason}`),
    '',
    '_Neuron proposes only. Never permanently deletes. Developer approval required._',
  ].join('\n');
}

export function createBrainHealthReporter(): BrainHealthReporter {
  return new BrainHealthReporter();
}
