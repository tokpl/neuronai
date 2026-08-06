import type { MemoryRecord } from '@neuronai/types';

import { computeHealth, emptyDna, nowIso } from './defaults.js';
import { dedupeRecords, findDuplicate, mergeRecords } from './dedupe.js';
import type {
  BrainPrefs,
  KnowledgeGraph,
  KnowledgePlane,
  ProjectDna,
  ProjectHealth,
  ProjectMap,
} from './models.js';
import type { ProjectBrain } from './project-brain.js';
import { brainDocs, retrieve } from './retrieval/index.js';

/**
 * Public mutation / query helpers on ProjectBrain.
 * Kept as methods on the class; this module holds shared logic to keep the class readable.
 */

export function applyDnaUpdate(brain: ProjectBrain, dna: ProjectDna): void {
  brain.dna = dna;
  brain.health = computeHealth(brain.dna, brain.knowledge);
}

export function applyKnowledgeUpdate(brain: ProjectBrain, patch: Partial<KnowledgePlane>): void {
  brain.knowledge = {
    ...brain.knowledge,
    ...patch,
    version: 1,
    updatedAt: nowIso(),
  };
  brain.health = computeHealth(brain.dna, brain.knowledge);
}

export function applyMapUpdate(brain: ProjectBrain, map: ProjectMap): void {
  brain.knowledge = {
    ...brain.knowledge,
    map: { version: 1, updatedAt: nowIso(), entries: map.entries },
    updatedAt: nowIso(),
  };
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

export function applyHealthUpdate(brain: ProjectBrain, patch: Partial<ProjectHealth>): void {
  brain.health = {
    ...brain.health,
    ...patch,
    version: 1,
    updatedAt: nowIso(),
  };
}

/**
 * Append a decision, collapsing it into an existing one when it carries the same
 * knowledge. Content-level dedupe — id equality alone let duplicates accumulate.
 */
export function appendDecision(brain: ProjectBrain, decision: MemoryRecord): void {
  const decisions = brain.knowledge.decisions.filter((d) => d.id !== decision.id);

  const duplicate = findDuplicate(decision, decisions);
  if (duplicate) {
    const index = decisions.findIndex((d) => d.id === duplicate.existing.id);
    decisions[index] = mergeRecords(duplicate.existing, decision);
  } else {
    decisions.push(decision);
  }

  applyKnowledgeUpdate(brain, { decisions });
}

/** Result of folding engine memories into the knowledge plane. */
export interface LearnOutcome {
  duplicatesRemoved: number;
}

export function learnFromMemories(brain: ProjectBrain, memories: MemoryRecord[]): LearnOutcome {
  const active = memories.filter((m) => m.status === 'active');
  const decisionsRaw = active.filter((m) => m.type === 'architecture_decision');
  const rulesFromMemory = active.filter((m) => m.type === 'business_rule');
  const used = new Set([...decisionsRaw, ...rulesFromMemory].map((m) => m.id));
  const memoryRaw = active.filter((m) => !used.has(m.id));

  // Collapse repeats that entered the store before write-time dedupe existed.
  const dedupedDecisions = dedupeRecords(decisionsRaw);
  const dedupedMemory = dedupeRecords(memoryRaw);
  const decisions = dedupedDecisions.records;
  const memory = dedupedMemory.records;

  applyKnowledgeUpdate(brain, {
    memory,
    decisions,
    rules: [
      ...brain.knowledge.rules.filter((r) => !r.id.startsWith('mem:')),
      ...dedupeRecords(rulesFromMemory).records.map((m) => ({
        id: `mem:${m.id}`,
        title: m.title,
        body: m.content,
        critical: m.importanceScore >= 0.8,
      })),
    ],
  });

  return { duplicatesRemoved: dedupedDecisions.removed + dedupedMemory.removed };
}

export interface BrainQueryHit {
  id: string;
  kind: string;
  title: string;
  content: string;
  score: number;
  /** Human-readable match reason. Never sent to the LLM. */
  why: string;
}

/**
 * Read helper over the durable brain. Ranking lives in `./retrieval` —
 * this only adapts the knowledge planes into that engine.
 */
export function queryKnowledge(brain: ProjectBrain, query: string, limit = 10): BrainQueryHit[] {
  if (!query.trim()) return [];

  const result = retrieve(query, brainDocs({ knowledge: brain.knowledge, dna: brain.dna }), {
    limit,
  });

  return result.hits.map((hit) => ({
    id: hit.doc.id,
    kind: hit.doc.kind,
    title: hit.doc.title,
    content: hit.doc.content,
    score: hit.score,
    why: hit.why,
  }));
}

export function explainBrain(brain: ProjectBrain): string {
  const s = brain.status();
  const lines = [
    `Project Brain health ${s.healthPercent}%`,
    `DNA: ${s.dnaUpdated ? 'present' : 'missing'} (confidence ${s.confidencePercent}%)`,
    `Knowledge: ${s.memoryCount} memories, ${s.decisionCount} decisions`,
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
