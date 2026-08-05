import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MemoryRecord } from '@neuron-ai-memory/types';

import { createGovernanceAuditLog } from '../archival/audit-log.js';
import { createMemoryArchive } from '../archival/memory-archive.js';
import { createCleanupEngine } from '../cleanup/cleanup-engine.js';
import { createMemorySimilarityEngine } from '../cleanup/similarity-engine.js';
import { createStaleMemoryDetector } from '../cleanup/stale-detector.js';
import { createMemoryConflictDetector } from '../conflicts/conflict-detector.js';
import { createMemoryReviewQueue } from '../health/review-queue.js';
import { createMemoryDecayEngine } from '../lifecycle/decay-engine.js';
import { createMemoryLifecycle } from '../lifecycle/states.js';
import { createGovernancePolicyEngine } from '../policies/policy-engine.js';
import { createMemoryHealthScorer } from '../quality/health-scorer.js';
import { createMemoryImportanceCalculator } from '../quality/importance-calculator.js';
import { createBrainHealthReporter } from '../reports/brain-report.js';
import { createMaintenanceScheduler } from '../scheduler/maintenance.js';
import { createMemoryValidator } from '../validation/memory-validator.js';
import type {
  BrainHealthReport,
  CleanupSuggestion,
  GovernanceScanInput,
  MaintenanceCadence,
  ReviewQueueItem,
} from '../types.js';

/**
 * Memory Governance facade — lifecycle, decay, conflicts, cleanup proposals.
 * Never permanently deletes knowledge. All mutations require approval + audit.
 */
export class MemoryGovernanceEngine {
  private readonly health = createMemoryHealthScorer();
  private readonly stale = createStaleMemoryDetector();
  private readonly conflicts = createMemoryConflictDetector();
  private readonly similarity = createMemorySimilarityEngine();
  private readonly queue = createMemoryReviewQueue();
  private readonly policies = createGovernancePolicyEngine();
  private readonly reporter = createBrainHealthReporter();
  private readonly scheduler = createMaintenanceScheduler();
  private readonly decay = createMemoryDecayEngine();
  private readonly importance = createMemoryImportanceCalculator();
  private readonly validator = createMemoryValidator();
  private readonly archive = createMemoryArchive();
  private readonly cleanup = createCleanupEngine();
  private readonly lifecycle = createMemoryLifecycle();
  private readonly audit = createGovernanceAuditLog();

  scan(input: GovernanceScanInput): BrainHealthReport {
    const now = input.now ?? new Date();
    const memories = input.memories;

    const staleSignals = this.stale.detect(memories, {
      codeSignals: input.codeSignals,
      now,
    });
    const conflictSuggestions = this.conflicts.detect(memories);
    const duplicateSuggestions = this.similarity.detect(memories);

    const staleIds = new Set(staleSignals.map((s) => s.memoryId));
    const conflictOlder = new Set(conflictSuggestions.map((c) => c.olderId));
    const conflictAll = new Set([
      ...conflictSuggestions.map((c) => c.olderId),
      ...conflictSuggestions.map((c) => c.newerId),
    ]);

    const validations = this.validator.validateMany(memories, {
      codeSignals: input.codeSignals,
      testMentions: input.validationSignals?.testMentions,
      gitSubjects: input.validationSignals?.gitSubjects,
    });
    const validatedIds = new Set(validations.filter((v) => v.valid).map((v) => v.memoryId));

    const relatedIndex = buildRelationHints(memories);

    const decayAdjustments = this.decay.adjustMany(memories, {
      now,
      staleIds,
      conflictIds: conflictAll,
      projectChangedIds: staleIds,
    });

    const scores = memories
      .filter((m) => m.status === 'active')
      .map((m) =>
        this.health.score(m, {
          now,
          relatedCount: relatedIndex.get(m.id) ?? 0,
          staleBoost: staleIds.has(m.id) ? 0.3 : 0,
          conflictPenalty: conflictOlder.has(m.id) ? 0.35 : 0,
          validated: validatedIds.has(m.id),
        }),
      );

    const reviewQueue = this.queue.build({
      memories,
      stale: staleSignals,
      conflicts: conflictSuggestions,
      duplicates: duplicateSuggestions,
      now,
    });

    const cleanupSuggestions = this.queue
      .toCleanupSuggestions(reviewQueue, {
        conflicts: conflictSuggestions,
        duplicates: duplicateSuggestions,
      })
      .filter((s) => this.allowedSuggestion(s, memories));

    const unusedRules = (input.rules ?? []).filter((r) => {
      const token = r.toLowerCase().slice(0, 24);
      return !memories.some((m) =>
        `${m.title} ${m.content}`.toLowerCase().includes(token.slice(0, 12)),
      );
    }).length;

    const report = this.reporter.build({
      memories,
      scores,
      reviewQueue,
      cleanupSuggestions,
      decayAdjustments,
      unusedRules,
    });

    this.audit.append({
      action: 'scan',
      memoryIds: [],
      detail: `health=${report.overallScore} conflicts=${report.totals.conflicts} outdated=${report.totals.outdated}`,
      actor: 'governance-engine',
    });

    return report;
  }

  reviewQueue(input: GovernanceScanInput): ReviewQueueItem[] {
    return this.scan(input).reviewQueue;
  }

  cleanupSuggestions(input: GovernanceScanInput): CleanupSuggestion[] {
    return this.scan(input).cleanupSuggestions;
  }

  memoryConflicts(input: GovernanceScanInput) {
    return this.conflicts.detect(input.memories);
  }

  runCleanup(input: GovernanceScanInput) {
    const report = this.scan(input);
    const operations = this.cleanup.fromSuggestions(report.cleanupSuggestions);
    const recalculate = this.cleanup.planRecalculate(
      report.scores.filter((s) => s.healthScore < 60).map((s) => s.memoryId),
    );
    this.audit.append({
      action: 'cleanup_plan',
      memoryIds: operations.flatMap((o) => o.memoryIds),
      detail: `${operations.length} ops + recalculate (approval required, never delete)`,
      actor: 'governance-engine',
    });
    return {
      report,
      operations: [...operations, recalculate],
      archiveProposals: report.scores
        .filter((s) => s.lifecycle === 'OUTDATED')
        .slice(0, 20)
        .map((s) => {
          const m = input.memories.find((x) => x.id === s.memoryId);
          return m
            ? this.archive.propose(m, s.whyReviewOrRemove ?? 'outdated', 'OUTDATED')
            : null;
        })
        .filter(Boolean),
      note: 'Proposals only — permanent delete never offered. Approve explicitly to apply via memory-engine.',
    };
  }

  maintenancePlan(cadence: MaintenanceCadence = 'weekly') {
    return this.scheduler.plan(cadence);
  }

  setMaintenance(enabled: boolean, cadence?: MaintenanceCadence) {
    return this.scheduler.setConfig({
      enabled,
      ...(cadence ? { cadence } : {}),
    });
  }

  policiesList() {
    return this.policies.list();
  }

  recentAudit(limit = 40) {
    return this.audit.list(limit);
  }

  lifecycleHelper() {
    return this.lifecycle;
  }

  importanceOf(memory: MemoryRecord, relatedCount = 0) {
    return this.importance.calculate(memory, { relatedCount });
  }

  async writeHealthReport(neuronDir: string, report: BrainHealthReport): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'memory-health.md');
    await writeFile(path, `${report.markdown}\n`, 'utf8');
    this.audit.append({
      action: 'write_memory_health_md',
      memoryIds: [],
      detail: path,
      actor: 'governance-engine',
    });
    return path;
  }

  private allowedSuggestion(s: CleanupSuggestion, memories: MemoryRecord[]): boolean {
    if (s.action !== 'archive') return true;
    return s.memoryIds.every((id) => {
      const m = memories.find((x) => x.id === id);
      return m ? this.policies.allowsArchiveSuggestion(m) : true;
    });
  }
}

function buildRelationHints(memories: MemoryRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of memories) {
    const tokens = `${m.title} ${m.content}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3);
    let related = 0;
    for (const other of memories) {
      if (other.id === m.id) continue;
      const hay = `${other.title} ${other.content}`.toLowerCase();
      if (tokens.some((t) => hay.includes(t))) related += 1;
    }
    map.set(m.id, Math.min(10, related));
  }
  return map;
}

export function createMemoryGovernanceEngine(): MemoryGovernanceEngine {
  return new MemoryGovernanceEngine();
}
