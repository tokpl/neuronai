import type { MemorySearchEngine } from '@neuronai/ai-memory';
import type { ProjectIntelligenceEngine } from '@neuronai/knowledge-graph';
import type { MemoryEngine } from '@neuronai/memory-engine';
import type { MemoryRecord } from '@neuronai/types';

import { getAgentModeProfile, type AgentMode } from '../modes/agent-mode.js';
import { ContextRanker, type RankedContextItem } from './context-ranker.js';
import { TaskAnalyzer, type AnalyzedTask } from './task-analyzer.js';

export interface AgentContext {
  task: AnalyzedTask;
  mode: AgentMode;
  architectureNotes: string[];
  decisions: RankedContextItem[];
  patterns: RankedContextItem[];
  warnings: string[];
  relatedModules: string[];
  impactSummary?: string;
  impactScore?: number;
  ranked: RankedContextItem[];
  /** Compact briefing for the agent (not a dump) */
  briefing: string;
}

export interface ContextEngineDeps {
  projectId: string;
  engine: MemoryEngine;
  searchEngine?: MemorySearchEngine;
  intelligence?: ProjectIntelligenceEngine;
  listMemories?: () => Promise<MemoryRecord[]>;
}

/**
 * Task → analyze → graph + memory → rank → assemble focused agent context.
 */
export class ContextEngine {
  private readonly tasks = new TaskAnalyzer();
  private readonly ranker = new ContextRanker();

  constructor(private readonly deps: ContextEngineDeps) {}

  async build(task: string, mode: AgentMode = 'standard'): Promise<AgentContext> {
    const profile = getAgentModeProfile(mode);
    const analyzed = this.tasks.analyze(task);

    const memories = this.deps.listMemories
      ? await this.deps.listMemories()
      : (
          await this.deps.engine.getProjectMemoryContext({
            projectId: this.deps.projectId,
            limit: 100,
            maxTokens: 50_000,
          })
        ).memories;

    let searchHits: Array<{ memory: MemoryRecord; score: number }> = [];
    if (this.deps.searchEngine) {
      const hits = await this.deps.searchEngine.search({
        projectId: this.deps.projectId,
        query: `${task} ${analyzed.affectedAreas.join(' ')}`,
        limit: profile.memoryLimit * 2,
      });
      searchHits = hits.map((h) => ({ memory: h.memory, score: h.score }));
    }

    const byId = new Map<string, MemoryRecord>();
    for (const m of memories) byId.set(m.id, m);
    for (const h of searchHits) byId.set(h.memory.id, h.memory);

    const relatedModules: string[] = [...analyzed.affectedAreas];
    let impactSummary: string | undefined;
    let impactScore: number | undefined;

    if (this.deps.intelligence) {
      for (const area of analyzed.affectedAreas.slice(0, 4)) {
        const impact = await this.deps.intelligence.impactAnalysis(this.deps.projectId, area);
        if (impact) {
          for (const a of impact.affected.slice(0, 6)) {
            if (!relatedModules.includes(a.node.name)) relatedModules.push(a.node.name);
          }
          if (!impactSummary || (impact.impactScore ?? 0) > (impactScore ?? 0)) {
            impactSummary = impact.summary;
            impactScore = impact.impactScore;
          }
        }
      }
    }

    const rankable = [...byId.values()].map((memory) => {
      const hay = `${memory.title} ${memory.content}`.toLowerCase();
      const dist = analyzed.affectedAreas.some((a) => hay.includes(a)) ? 0 : 2;
      return { memory, graphDistance: dist };
    });

    const ranked = this.ranker.rank(analyzed, rankable, profile.memoryLimit);
    const decisions = ranked.filter(
      (r) =>
        byId.get(r.id)?.type === 'architecture_decision' ||
        /decision|jwt|rbac|architecture/i.test(r.title),
    );
    const patterns = ranked.filter((r) => {
      const t = byId.get(r.id)?.type;
      return t === 'pattern' || t === 'knowledge';
    });

    const warnings: string[] = [];
    for (const m of memories) {
      if (m.type === 'mistake' && ranked.some((r) => r.id === m.id || r.score > 0.4)) {
        if (analyzed.keywords.some((k) => `${m.title} ${m.content}`.toLowerCase().includes(k))) {
          warnings.push(m.title);
        }
      }
    }
    for (const item of ranked) {
      if (/do not|don't|never|bypass|avoid/i.test(item.content) && !warnings.includes(item.title)) {
        warnings.push(item.title);
      }
    }

    const architectureNotes = [
      ...relatedModules.slice(0, 8).map((m) => `Involves area/module: ${m}`),
      ...(impactSummary ? [impactSummary] : []),
      ...decisions.slice(0, 5).map((d) => d.title),
    ];

    const briefing = assembleBriefing({
      analyzed,
      decisions: decisions.slice(0, 6),
      warnings: warnings.slice(0, 6),
      relatedModules: relatedModules.slice(0, 8),
      ranked: ranked.slice(0, profile.memoryLimit),
    });

    return {
      task: analyzed,
      mode: profile.mode,
      architectureNotes,
      decisions: decisions.slice(0, 8),
      patterns: patterns.slice(0, 8),
      warnings: warnings.slice(0, 8),
      relatedModules: relatedModules.slice(0, 12),
      impactSummary,
      impactScore,
      ranked,
      briefing,
    };
  }
}

function assembleBriefing(input: {
  analyzed: AnalyzedTask;
  decisions: RankedContextItem[];
  warnings: string[];
  relatedModules: string[];
  ranked: RankedContextItem[];
}): string {
  // Internal assembly only — no ranking scores (those stay in RankedContextItem).
  const lines = [
    `Task type: ${input.analyzed.type}`,
    `Affected areas: ${input.analyzed.affectedAreas.join(', ')}`,
    '',
    '## Relevant Architecture',
    ...input.relatedModules.map((m) => `- ${m}`),
    '',
    '## Existing Decisions',
    ...(input.decisions.length
      ? input.decisions.map((d) => `- ${d.title}`)
      : ['- (none ranked highly yet)']),
    '',
    '## Warnings',
    ...(input.warnings.length ? input.warnings.map((w) => `- ${w}`) : ['- (none)']),
    '',
    '## Top context',
    ...input.ranked.slice(0, 8).map((r) => `- ${r.title}`),
  ];
  return lines.join('\n');
}

export function createContextEngine(deps: ContextEngineDeps): ContextEngine {
  return new ContextEngine(deps);
}
