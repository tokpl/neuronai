import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { MemoryRecord } from '@neuronai/types';

import {
  applyActiveUpdate,
  applyDnaUpdate,
  applyGoalsUpdate,
  applyGraphUpdate,
  applyHealthUpdate,
  applyKnowledgeUpdate,
  appendContextCrumb,
  appendDecision,
  appendInsight,
  evolveHealth,
  explainBrain,
  learnFromMemories,
  queryKnowledge,
  seedDnaIdentity,
} from './api.js';
import {
  computeHealth,
  emptyActive,
  emptyDna,
  emptyGoals,
  emptyHealth,
  emptyKnowledge,
  nowIso,
} from './defaults.js';
import type {
  ActiveContext,
  BrainPaths,
  BrainPrefs,
  BrainStatus,
  KnowledgeGraph,
  KnowledgePlane,
  ProjectDna,
  ProjectGoals,
  ProjectHealth,
} from './models.js';
import {
  createBrainCompiler,
  type BrainCompileInput,
  type CompiledBrainPrompt,
} from './compiler/index.js';
import {
  computeBrainMetrics,
  explainMetric,
  formatBrainMetricsReport,
} from './metrics.js';
import { resolveBrainPaths } from './paths.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export type OpenProjectBrainOptions = {
  seed?: {
    projectId?: string;
    name?: string;
    stack?: string[];
    summary?: string;
  };
};

/**
 * Single runtime entry for the project.
 * All DNA / Knowledge / Health / Goals / Active / Graph mutations go through this API.
 */
export class ProjectBrain {
  readonly paths: BrainPaths;
  dna: ProjectDna;
  knowledge: KnowledgePlane;
  health: ProjectHealth;
  goals: ProjectGoals;
  active: ActiveContext;
  prefs: BrainPrefs | null;
  readonly migrationNotes: string[];

  private constructor(
    paths: BrainPaths,
    state: {
      dna: ProjectDna;
      knowledge: KnowledgePlane;
      health: ProjectHealth;
      goals: ProjectGoals;
      active: ActiveContext;
      prefs: BrainPrefs | null;
      migrationNotes: string[];
    },
  ) {
    this.paths = paths;
    this.dna = state.dna;
    this.knowledge = state.knowledge;
    this.health = state.health;
    this.goals = state.goals;
    this.active = state.active;
    this.prefs = state.prefs;
    this.migrationNotes = state.migrationNotes;
  }

  static async open(
    projectRoot: string,
    options: OpenProjectBrainOptions = {},
  ): Promise<ProjectBrain> {
    const paths = resolveBrainPaths(projectRoot);
    const notes: string[] = [];

    await mkdir(paths.neuronDir, { recursive: true });
    await mkdir(paths.brainDir, { recursive: true });
    await mkdir(paths.evolutionDir, { recursive: true });
    await mkdir(paths.runtimeDir, { recursive: true });
    await mkdir(paths.cacheDir, { recursive: true });
    await mkdir(paths.logsDir, { recursive: true });
    await mkdir(paths.indexesDir, { recursive: true });

    const legacyStore = join(paths.neuronDir, 'data', 'store.json');
    if ((await exists(legacyStore)) && !(await exists(paths.store))) {
      await rename(legacyStore, paths.store);
      notes.push('Moved data/store.json → runtime/store.json');
    }

    if (!(await exists(paths.prefs)) && (await exists(join(paths.neuronDir, 'config.json')))) {
      await rename(join(paths.neuronDir, 'config.json'), paths.prefs);
      notes.push('Moved config.json → prefs.json');
    }

    const prefs = (await exists(paths.prefs))
      ? await readJson<BrainPrefs | null>(paths.prefs, null)
      : null;

    let dna: ProjectDna;
    let knowledge: KnowledgePlane;
    let health: ProjectHealth;
    let goals: ProjectGoals;
    let active: ActiveContext;

    const hasNewLayout = await exists(paths.knowledge);

    if (hasNewLayout) {
      dna = await readJson(paths.dna, emptyDna());
      knowledge = await readJson(paths.knowledge, emptyKnowledge());
      health = await readJson(paths.health, emptyHealth());
      goals = await readJson(paths.goals, emptyGoals());
      active = await readJson(paths.active, emptyActive());
    } else {
      const migrated = await migrateFlatLayout(paths, prefs, options.seed);
      dna = migrated.dna;
      knowledge = migrated.knowledge;
      health = migrated.health;
      goals = migrated.goals;
      active = migrated.active;
      notes.push(...migrated.notes);
    }

    if (!dna.identity.name && (options.seed || prefs)) {
      dna = emptyDna({
        projectId: options.seed?.projectId ?? prefs?.project?.id,
        name: options.seed?.name ?? prefs?.project?.name,
        stack: options.seed?.stack ?? prefs?.project?.stack,
        summary: options.seed?.summary,
      });
    }

    health = computeHealth(dna, knowledge);

    const brain = new ProjectBrain(paths, {
      dna,
      knowledge,
      health,
      goals,
      active,
      prefs,
      migrationNotes: notes,
    });
    await brain.save();
    return brain;
  }

  /** Reload durable state from disk into this instance. */
  async load(): Promise<this> {
    this.dna = await readJson(this.paths.dna, this.dna);
    this.knowledge = await readJson(this.paths.knowledge, this.knowledge);
    this.health = await readJson(this.paths.health, this.health);
    this.goals = await readJson(this.paths.goals, this.goals);
    this.active = await readJson(this.paths.active, this.active);
    this.prefs = (await exists(this.paths.prefs))
      ? await readJson<BrainPrefs | null>(this.paths.prefs, this.prefs)
      : this.prefs;
    return this;
  }

  async save(): Promise<void> {
    this.health = computeHealth(this.dna, this.knowledge);
    this.knowledge = { ...this.knowledge, updatedAt: nowIso() };
    await writeJson(this.paths.dna, this.dna);
    await writeJson(this.paths.knowledge, this.knowledge);
    await writeJson(this.paths.health, this.health);
    await writeJson(this.paths.goals, this.goals);
    await writeJson(this.paths.active, this.active);
    if (this.prefs) {
      await writeJson(this.paths.prefs, this.prefs);
    }
  }

  async savePrefs(prefs: BrainPrefs): Promise<void> {
    this.prefs = prefs;
    await writeJson(this.paths.prefs, prefs);
  }

  async updateDNA(dna: ProjectDna): Promise<void> {
    applyDnaUpdate(this, dna);
    await this.save();
  }

  async updateKnowledge(patch: Partial<KnowledgePlane>): Promise<void> {
    applyKnowledgeUpdate(this, patch);
    await this.save();
  }

  async updateGraph(graph: KnowledgeGraph): Promise<void> {
    applyGraphUpdate(this, graph);
    await this.save();
  }

  async updateHealth(patch: Partial<ProjectHealth>): Promise<void> {
    applyHealthUpdate(this, patch);
    await this.save();
  }

  async updateGoals(goals: ProjectGoals): Promise<void> {
    applyGoalsUpdate(this, goals);
    await this.save();
  }

  async updateActive(active: ActiveContext): Promise<void> {
    applyActiveUpdate(this, active);
    await this.save();
  }

  async recordDecision(decision: MemoryRecord): Promise<void> {
    appendDecision(this, decision);
    await this.save();
  }

  async recordInsight(insight: {
    id: string;
    title: string;
    content: string;
    kind?: string;
    confidence?: number;
  }): Promise<void> {
    appendInsight(this, insight);
    await this.save();
  }

  async recordContext(crumb: {
    id: string;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<void> {
    appendContextCrumb(this, crumb);
    await this.save();
  }

  /** Ingest engine memories into the knowledge plane (curated SoT). */
  async learn(memories: MemoryRecord[]): Promise<void> {
    learnFromMemories(this, memories);
    await this.save();
  }

  /** @deprecated use learn() */
  async syncFromMemories(memories: MemoryRecord[]): Promise<void> {
    return this.learn(memories);
  }

  seedIdentity(input: {
    projectId: string;
    name: string;
    stack?: string[];
    summary?: string;
  }): void {
    seedDnaIdentity(this, input);
  }

  /** @deprecated use updateGraph */
  setGraph(graph: { nodes: unknown[]; edges: unknown[] }): void {
    applyGraphUpdate(this, graph);
  }

  getGraph(): KnowledgeGraph {
    return this.knowledge.graph;
  }

  query(query: string, limit = 10) {
    return queryKnowledge(this, query, limit);
  }

  explain(): string {
    return explainBrain(this);
  }

  /** Recompute health from current DNA + knowledge (evolution tick). */
  async evolve(): Promise<void> {
    evolveHealth(this);
    await this.save();
  }

  /** Truthful Brain Metrics (measured / derived / estimated). */
  metrics() {
    return computeBrainMetrics({
      dna: this.dna,
      knowledge: this.knowledge,
      health: this.health,
      goals: this.goals,
      active: this.active,
      initializedAt: this.dna.meta.generatedAt,
    });
  }

  /** Explain a single metric key (e.g. health, architecture_confidence). */
  explainMetric(key: string): string {
    return explainMetric(this.metrics(), key);
  }

  /** Full CLI / UX report for `neuron brain`. */
  formatMetricsReport(): string {
    return formatBrainMetricsReport(this.metrics());
  }

  /**
   * Compile retrieved knowledge into a minimal LLM prompt.
   * Internal Brain ≠ Prompt — scores, ids, and ranking metadata stay out.
   */
  compilePrompt(input: BrainCompileInput): CompiledBrainPrompt {
    return createBrainCompiler().compile(input);
  }

  explainPromptInclusion(compiled: CompiledBrainPrompt, titleOrId: string): string {
    return createBrainCompiler().explainInclusion(compiled, titleOrId);
  }

  status(): BrainStatus {
    const goal =
      this.goals.goals.find((g) => g.id === this.goals.currentId) ??
      this.goals.goals.find((g) => g.status === 'active');
    return {
      healthPercent: this.health.score,
      dnaUpdated: this.health.dnaFresh,
      knowledgeUpdated: this.health.knowledgeFresh,
      architectureHealthy: this.health.architectureHealthy,
      currentGoal: goal?.title ?? null,
      activeFocus: this.active.focus,
      confidencePercent: Math.round(this.dna.meta.overallConfidence * 100),
      memoryCount: this.knowledge.memory.length,
      decisionCount: this.knowledge.decisions.length,
    };
  }
}

async function migrateFlatLayout(
  paths: BrainPaths,
  prefs: BrainPrefs | null,
  seed?: OpenProjectBrainOptions['seed'],
): Promise<{
  dna: ProjectDna;
  knowledge: KnowledgePlane;
  health: ProjectHealth;
  goals: ProjectGoals;
  active: ActiveContext;
  notes: string[];
}> {
  const notes: string[] = [];
  const neuron = paths.neuronDir;

  const legacyBrain = await readJson<{
    projectId?: string;
    name?: string;
    stack?: string[];
    summary?: string;
  } | null>(join(neuron, 'brain.json'), null);

  const legacyKnowledge = await readJson<{
    patterns?: MemoryRecord[];
    warnings?: MemoryRecord[];
    facts?: MemoryRecord[];
    other?: MemoryRecord[];
  }>(join(neuron, 'knowledge.json'), {});

  const legacyDecisions = await readJson<{ decisions?: MemoryRecord[] }>(
    join(neuron, 'decisions.json'),
    {},
  );

  const legacyRules = await readJson<{
    rules?: Array<{ id: string; title: string; body: string; critical?: boolean }>;
  }>(join(neuron, 'rules.json'), {});

  const legacyGraph = await readJson<{ nodes?: unknown[]; edges?: unknown[] }>(
    join(neuron, 'graph.json'),
    {},
  );

  const legacyDataGraph = await readJson<{ nodes?: unknown[]; edges?: unknown[] }>(
    join(neuron, 'data', 'graph.json'),
    {},
  );

  const dna = emptyDna({
    projectId: seed?.projectId ?? legacyBrain?.projectId ?? prefs?.project?.id,
    name: seed?.name ?? legacyBrain?.name ?? prefs?.project?.name,
    stack: seed?.stack ?? legacyBrain?.stack ?? prefs?.project?.stack,
    summary: seed?.summary ?? legacyBrain?.summary,
  });

  const memory = [
    ...(legacyKnowledge.patterns ?? []),
    ...(legacyKnowledge.warnings ?? []),
    ...(legacyKnowledge.facts ?? []),
    ...(legacyKnowledge.other ?? []),
  ];

  const knowledge: KnowledgePlane = {
    version: 1,
    updatedAt: nowIso(),
    memory,
    decisions: legacyDecisions.decisions ?? [],
    rules: legacyRules.rules ?? [],
    graph: {
      nodes: legacyGraph.nodes ?? legacyDataGraph.nodes ?? [],
      edges: legacyGraph.edges ?? legacyDataGraph.edges ?? [],
    },
    insights: [],
    context: [],
  };

  for (const file of [
    'brain.json',
    'knowledge.json',
    'decisions.json',
    'rules.json',
    'graph.json',
  ]) {
    const p = join(neuron, file);
    if (await exists(p)) {
      await rm(p, { force: true });
      notes.push(`Removed legacy ${file}`);
    }
  }

  if (await exists(join(neuron, 'data', 'graph.json'))) {
    await rm(join(neuron, 'data', 'graph.json'), { force: true });
    notes.push('Removed legacy data/graph.json');
  }

  if (
    memory.length +
      knowledge.decisions.length +
      knowledge.rules.length +
      knowledge.graph.nodes.length >
    0
  ) {
    notes.push('Migrated flat .neuron/*.json → brain/ layout');
  }

  return {
    dna,
    knowledge,
    health: computeHealth(dna, knowledge),
    goals: emptyGoals(),
    active: emptyActive(),
    notes,
  };
}

export async function openProjectBrain(
  projectRoot: string,
  options?: OpenProjectBrainOptions,
): Promise<ProjectBrain> {
  return ProjectBrain.open(projectRoot, options);
}
