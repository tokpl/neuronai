import type { MemoryRecord } from '@neuronai/types';

import { computeHealth, emptyDna, nowIso } from './defaults.js';
import type {
  ActiveContext,
  BrainPrefs,
  KnowledgeGraph,
  KnowledgePlane,
  ProjectDna,
  ProjectGoals,
  ProjectHealth,
} from './models.js';
import type { ProjectBrain } from './project-brain.js';

/**
 * Public mutation / query helpers on ProjectBrain.
 * Kept as methods on the class; this module holds shared logic to keep the class readable.
 */

export function applyDnaUpdate(brain: ProjectBrain, dna: ProjectDna): void {
  brain.dna = dna;
  brain.health = computeHealth(brain.dna, brain.knowledge);
}

export function applyKnowledgeUpdate(
  brain: ProjectBrain,
  patch: Partial<KnowledgePlane>,
): void {
  brain.knowledge = {
    ...brain.knowledge,
    ...patch,
    version: 1,
    updatedAt: nowIso(),
  };
  brain.health = computeHealth(brain.dna, brain.knowledge);
}

export function applyGraphUpdate(brain: ProjectBrain, graph: KnowledgeGraph): void {
  brain.knowledge = {
    ...brain.knowledge,
    graph: {
      nodes: graph.nodes,
      edges: graph.edges,
      changes: graph.changes ?? brain.knowledge.graph.changes ?? [],
    },
    updatedAt: nowIso(),
  };
}

export function applyHealthUpdate(
  brain: ProjectBrain,
  patch: Partial<ProjectHealth>,
): void {
  brain.health = {
    ...brain.health,
    ...patch,
    version: 1,
    updatedAt: nowIso(),
  };
}

export function applyGoalsUpdate(brain: ProjectBrain, goals: ProjectGoals): void {
  brain.goals = { ...goals, version: 1, updatedAt: nowIso() };
}

export function applyActiveUpdate(brain: ProjectBrain, active: ActiveContext): void {
  brain.active = { ...active, version: 1, updatedAt: nowIso() };
}

export function appendDecision(brain: ProjectBrain, decision: MemoryRecord): void {
  const decisions = brain.knowledge.decisions.filter((d) => d.id !== decision.id);
  decisions.push(decision);
  applyKnowledgeUpdate(brain, { decisions });
}

export function appendInsight(
  brain: ProjectBrain,
  insight: {
    id: string;
    title: string;
    content: string;
    kind?: string;
    confidence?: number;
  },
): void {
  const insights = brain.knowledge.insights.filter((i) => i.id !== insight.id);
  insights.push({ ...insight, updatedAt: nowIso() });
  applyKnowledgeUpdate(brain, { insights });
}

export function appendContextCrumb(
  brain: ProjectBrain,
  crumb: {
    id: string;
    title: string;
    content: string;
    tags?: string[];
  },
): void {
  const context = brain.knowledge.context.filter((c) => c.id !== crumb.id);
  context.push({ ...crumb, updatedAt: nowIso() });
  applyKnowledgeUpdate(brain, { context });
}

export function learnFromMemories(
  brain: ProjectBrain,
  memories: MemoryRecord[],
): void {
  const active = memories.filter((m) => m.status === 'active');
  const decisions = active.filter((m) => m.type === 'architecture_decision');
  const rulesFromMemory = active.filter((m) => m.type === 'business_rule');
  const used = new Set([...decisions, ...rulesFromMemory].map((m) => m.id));
  const memory = active.filter((m) => !used.has(m.id));

  applyKnowledgeUpdate(brain, {
    memory,
    decisions,
    rules: [
      ...brain.knowledge.rules.filter((r) => !r.id.startsWith('mem:')),
      ...rulesFromMemory.map((m) => ({
        id: `mem:${m.id}`,
        title: m.title,
        body: m.content,
        critical: m.importanceScore >= 0.8,
      })),
    ],
  });
}

export function queryKnowledge(
  brain: ProjectBrain,
  query: string,
  limit = 10,
): Array<{ kind: string; title: string; content: string; score: number }> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const hits: Array<{ kind: string; title: string; content: string; score: number }> = [];

  const push = (kind: string, title: string, content: string) => {
    const hay = `${title}\n${content}`.toLowerCase();
    if (!hay.includes(q) && !q.split(/\s+/).some((t) => t.length > 2 && hay.includes(t))) {
      return;
    }
    const score =
      (hay.includes(q) ? 1 : 0.4) +
      (title.toLowerCase().includes(q) ? 0.3 : 0);
    hits.push({ kind, title, content, score });
  };

  for (const m of brain.knowledge.memory) push('memory', m.title, m.content);
  for (const d of brain.knowledge.decisions) push('decision', d.title, d.content);
  for (const r of brain.knowledge.rules) push('rule', r.title, r.body);
  for (const i of brain.knowledge.insights) push('insight', i.title, i.content);
  for (const c of brain.knowledge.context) push('context', c.title, c.content);

  const dnaName = brain.dna.identity.name?.value;
  const dnaSummary = brain.dna.meta.summary;
  if (dnaName || dnaSummary) {
    push('dna', dnaName ?? 'DNA', dnaSummary ?? JSON.stringify(brain.dna.stack));
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function explainBrain(brain: ProjectBrain): string {
  const s = brain.status();
  const lines = [
    `Project Brain health ${s.healthPercent}%`,
    `DNA: ${s.dnaUpdated ? 'present' : 'missing'} (confidence ${s.confidencePercent}%)`,
    `Knowledge: ${s.memoryCount} memories, ${s.decisionCount} decisions`,
    `Goal: ${s.currentGoal ?? 'none'}`,
    `Active: ${s.activeFocus ?? 'none'}`,
    `Architecture: ${s.architectureHealthy ? 'healthy' : 'needs attention'}`,
  ];
  if (brain.dna.meta.summary) lines.push(`Summary: ${brain.dna.meta.summary}`);
  return lines.join('\n');
}

export function evolveHealth(brain: ProjectBrain): void {
  brain.health = computeHealth(brain.dna, brain.knowledge);
}

export function seedDnaIdentity(
  brain: ProjectBrain,
  input: {
    projectId: string;
    name: string;
    stack?: string[];
    summary?: string;
  },
): void {
  applyDnaUpdate(
    brain,
    emptyDna({
      projectId: input.projectId,
      name: input.name,
      stack: input.stack,
      summary: input.summary,
    }),
  );
}

export function prefsOrThrow(brain: ProjectBrain): BrainPrefs {
  if (!brain.prefs) {
    throw new Error('ProjectBrain prefs missing — run neuron init');
  }
  return brain.prefs;
}
