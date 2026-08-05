import type {
  ArchitectureDriftFinding,
  ContinuousState,
  FileChangeInsight,
  GitCommitInsight,
  LiveProjectHealth,
  MemorySuggestion,
  ProjectEvent,
} from '../types.js';
import { nowIso } from '../types.js';
import { createArchitectureDriftDetector } from '../analyzers/drift.js';
import { createFileChangeAnalyzer } from '../analyzers/file-change.js';
import { createGitIntelligence } from '../analyzers/git-intelligence.js';
import { createSensitiveChangeFilter } from '../analyzers/sensitive-filter.js';
import { createProjectEventBus, type ProjectEventBus } from '../events/bus.js';
import { createMemorySuggestionEngine } from '../recommendations/suggestions.js';
import { createProjectTimeline, type ProjectTimeline } from '../timeline/timeline.js';

/**
 * Orchestrates continuous intelligence updates from events.
 */
export class ContinuousUpdateEngine {
  private readonly bus: ProjectEventBus;
  private readonly files = createFileChangeAnalyzer();
  private readonly git: ReturnType<typeof createGitIntelligence>;
  private readonly drift = createArchitectureDriftDetector();
  private readonly suggestions = createMemorySuggestionEngine();
  private readonly sensitive = createSensitiveChangeFilter();
  private readonly timeline: ProjectTimeline;

  private insights: FileChangeInsight[] = [];
  private gitInsights: GitCommitInsight[] = [];
  private driftFindings: ArchitectureDriftFinding[] = [];
  private pending: MemorySuggestion[] = [];
  private cursorRules: MemorySuggestion[] = [];

  constructor(bus?: ProjectEventBus, timeline?: ProjectTimeline) {
    this.bus = bus ?? createProjectEventBus();
    this.timeline = timeline ?? createProjectTimeline();
    this.git = createGitIntelligence(this.bus);
  }

  getBus(): ProjectEventBus {
    return this.bus;
  }

  handleEvent(event: ProjectEvent): void {
    if (event.path && !this.sensitive.allow(event.path)) return;

    if (event.type.startsWith('FILE_')) {
      const insight = this.files.analyze(event);
      if (!insight) return;
      this.insights.unshift(insight);
      this.insights = this.insights.slice(0, 200);
      for (const s of this.suggestions.fromFileChange(insight, event.id)) {
        this.pushPending(s);
      }
      if (insight.importance === 'HIGH' || insight.importance === 'CRITICAL') {
        this.timeline.add({
          kind: 'feature',
          title: insight.summary,
          detail: `${insight.why} Affected: ${insight.affected.join(', ')}`,
        });
      }
    }

    if (event.type === 'GIT_COMMIT' && event.detail) {
      const paths = (event.metadata?.['paths'] as string[] | undefined) ?? [];
      const insight = this.git.analyzeCommitMessage(event.detail, paths);
      this.gitInsights.unshift(insight);
      this.gitInsights = this.gitInsights.slice(0, 100);
      for (const s of this.suggestions.fromGit(insight, event.id)) this.pushPending(s);
      this.timeline.add({
        kind: /migrat|jwt|auth/i.test(event.detail) ? 'migration' : 'feature',
        title: event.detail,
        detail: `Modules: ${insight.changedModules.join(', ') || 'n/a'}; related: ${insight.related.join(', ')}`,
      });
    }

    if (event.type === 'ARCHITECTURE_CHANGED') {
      this.timeline.add({
        kind: 'architecture',
        title: event.detail ?? 'Architecture changed',
        detail: event.path ?? 'project-wide',
      });
    }
  }

  recordDrift(path: string, content: string): ArchitectureDriftFinding[] {
    if (!this.sensitive.allow(path)) return [];
    const findings = this.drift.inspect(path, content);
    for (const f of findings) {
      this.driftFindings.unshift(f);
      for (const s of this.suggestions.fromDrift(f)) {
        this.cursorRules.unshift(s);
        this.pushPending(s);
      }
      this.timeline.add({
        kind: 'drift',
        title: 'Architecture violation detected',
        detail: f.message,
      });
    }
    this.driftFindings = this.driftFindings.slice(0, 100);
    this.cursorRules = this.cursorRules.slice(0, 50);
    return findings;
  }

  async ingestGitHead(cwd: string) {
    const result = await this.git.analyzeHead(cwd);
    if (!result) return null;
    this.handleEvent(result.event);
    return result;
  }

  liveHealth(): LiveProjectHealth {
    const openDrift = this.driftFindings.length;
    const pendingMemories = this.pending.length;
    const recentHighChanges = this.insights.filter(
      (i) => i.importance === 'HIGH' || i.importance === 'CRITICAL',
    ).length;
    const score = Math.max(
      0,
      Math.min(100, 100 - openDrift * 8 - Math.min(30, pendingMemories * 2) - recentHighChanges),
    );
    return {
      score,
      openDrift,
      pendingMemories,
      recentHighChanges,
      summary: `Live health ${score}/100 — ${openDrift} drift, ${pendingMemories} pending memories, ${recentHighChanges} high-impact file changes`,
      generatedAt: nowIso(),
    };
  }

  snapshot(projectRoot: string): ContinuousState {
    return {
      version: 1,
      projectRoot,
      events: this.bus.recent(100),
      insights: this.insights,
      gitInsights: this.gitInsights,
      drift: this.driftFindings,
      pendingMemories: this.pending,
      timeline: this.timeline.list(100),
      cursorRuleSuggestions: this.cursorRules,
      updatedAt: nowIso(),
    };
  }

  pendingMemories(): MemorySuggestion[] {
    return [...this.pending];
  }

  detectDrift(): ArchitectureDriftFinding[] {
    return [...this.driftFindings];
  }

  projectChanges(limit = 30) {
    return {
      files: this.insights.slice(0, limit),
      commits: this.gitInsights.slice(0, limit),
      events: this.bus.recent(limit),
    };
  }

  timelineMarkdown(): string {
    return this.timeline.markdown();
  }

  private pushPending(s: MemorySuggestion): void {
    if (this.pending.some((p) => p.title === s.title && p.kind === s.kind)) return;
    this.pending.unshift(s);
    this.pending = this.pending.slice(0, 100);
  }
}

export function createContinuousUpdateEngine(
  bus?: ProjectEventBus,
  timeline?: ProjectTimeline,
): ContinuousUpdateEngine {
  return new ContinuousUpdateEngine(bus, timeline);
}
