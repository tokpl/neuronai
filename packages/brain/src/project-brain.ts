import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { MemoryRecord } from '@neuronai/types';

import {
  applyDnaUpdate,
  applyGraphUpdate,
  applyHealthUpdate,
  applyKnowledgeUpdate,
  applyMapUpdate,
  applyCodeUpdate,
  appendDecision,
  evolveHealth,
  explainBrain,
  learnFromMemories,
  queryKnowledge,
  seedDnaIdentity,
  type BrainQueryHit,
} from './api.js';
import { computeHealth, emptyDna, emptyKnowledge, emptyMap, nowIso } from './defaults.js';
import type {
  BrainPaths,
  BrainPrefs,
  BrainStatus,
  KnowledgeGraph,
  KnowledgePlane,
  ProjectDna,
  ProjectHealth,
  ProjectMap,
} from './models.js';
import type { CodeIntelligence } from '@neuronai/types';
import {
  explainFlow,
  explainSymbol,
  findSymbols,
  getDependencies,
  getDependents,
  getImpact,
  getSymbol,
} from './code/queries.js';
import { computeBrainMetrics, explainMetric, formatBrainMetricsReport } from './metrics.js';
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

/** Write via temp file + rename so an interrupted write cannot corrupt the brain. */
async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tmp, path);
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
 * Durable project state: persistence and lifecycle only.
 *
 * Ranking lives in `./retrieval`, prompt shaping lives in `./compiler`.
 * ProjectBrain owns what is on disk and nothing else.
 */
export class ProjectBrain {
  readonly paths: BrainPaths;
  dna: ProjectDna;
  knowledge: KnowledgePlane;
  health: ProjectHealth;
  prefs: BrainPrefs | null;
  readonly migrationNotes: string[];

  private constructor(
    paths: BrainPaths,
    state: {
      dna: ProjectDna;
      knowledge: KnowledgePlane;
      health: ProjectHealth;
      prefs: BrainPrefs | null;
      migrationNotes: string[];
    },
  ) {
    this.paths = paths;
    this.dna = state.dna;
    this.knowledge = state.knowledge;
    this.health = state.health;
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
    await mkdir(paths.runtimeDir, { recursive: true });
    await mkdir(paths.cacheDir, { recursive: true });

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

    if (await exists(paths.knowledge)) {
      dna = await readJson(paths.dna, emptyDna());
      knowledge = await readJson(paths.knowledge, emptyKnowledge());
    } else {
      const migrated = await migrateFlatLayout(paths, prefs, options.seed);
      dna = migrated.dna;
      knowledge = migrated.knowledge;
      notes.push(...migrated.notes);
    }

    notes.push(...(await removeRetiredFiles(paths)));

    if (!dna.identity.name && (options.seed || prefs)) {
      dna = emptyDna({
        projectId: options.seed?.projectId ?? prefs?.project?.id,
        name: options.seed?.name ?? prefs?.project?.name,
        stack: options.seed?.stack ?? prefs?.project?.stack,
        summary: options.seed?.summary,
      });
    }

    const brain = new ProjectBrain(paths, {
      dna,
      knowledge,
      health: computeHealth(dna, knowledge),
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

  /**
   * Replace the project map. Rebuilt wholesale by scan so that deleted files
   * stop being reported as authoritative locations.
   */
  async updateMap(map: ProjectMap): Promise<void> {
    applyMapUpdate(this, map);
    await this.save();
  }

  getMap(): ProjectMap {
    return this.knowledge.map ?? emptyMap();
  }

  async updateCode(code: CodeIntelligence): Promise<void> {
    applyCodeUpdate(this, code);
    await this.save();
  }

  getCode(): CodeIntelligence | undefined {
    return this.knowledge.code;
  }

  findSymbol(name: string) {
    return findSymbols(this.knowledge.code, name);
  }

  getSymbol(idOrName: string) {
    return getSymbol(this.knowledge.code, idOrName);
  }

  getDependencies(target: string) {
    return getDependencies(this.knowledge.code, target);
  }

  getDependents(target: string) {
    return getDependents(this.knowledge.code, target);
  }

  getImpact(target: string) {
    return getImpact(this.knowledge.code, target);
  }

  explainCode(target: string) {
    return explainSymbol(this.knowledge.code, target);
  }

  explainFlow(target: string) {
    return explainFlow(this.knowledge.code, target);
  }

  async updateHealth(patch: Partial<ProjectHealth>): Promise<void> {
    applyHealthUpdate(this, patch);
    await this.save();
  }

  /** Record a decision. Duplicates of existing knowledge are merged, not appended. */
  async recordDecision(decision: MemoryRecord): Promise<void> {
    appendDecision(this, decision);
    await this.save();
  }

  /**
   * Ingest engine memories into the knowledge plane (curated source of truth).
   * Reports how many duplicates were collapsed.
   */
  async learn(memories: MemoryRecord[]): Promise<{ duplicatesRemoved: number }> {
    const outcome = learnFromMemories(this, memories);
    await this.save();
    return outcome;
  }

  seedIdentity(input: {
    projectId: string;
    name: string;
    stack?: string[];
    summary?: string;
  }): void {
    seedDnaIdentity(this, input);
  }

  getGraph(): KnowledgeGraph {
    return this.knowledge.graph;
  }

  /** Ranked read over durable knowledge. Algorithm lives in `./retrieval`. */
  query(query: string, limit = 10): BrainQueryHit[] {
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

  status(): BrainStatus {
    return {
      healthPercent: this.health.score,
      dnaUpdated: this.health.dnaFresh,
      knowledgeUpdated: this.health.knowledgeFresh,
      architectureHealthy: this.health.architectureHealthy,
      confidencePercent: Math.round(this.dna.meta.overallConfidence * 100),
      memoryCount: this.knowledge.memory.length,
      decisionCount: this.knowledge.decisions.length,
    };
  }
}

/**
 * Planes that were written on every save but never populated or read.
 * Removed on open so existing installs stop carrying them.
 */
async function removeRetiredFiles(paths: BrainPaths): Promise<string[]> {
  const notes: string[] = [];
  const retired = [join(paths.brainDir, 'goals.json'), join(paths.brainDir, 'active.json')];
  for (const path of retired) {
    if (await exists(path)) {
      await rm(path, { force: true });
      notes.push(`Removed unused ${path.split(/[\\/]/).pop()}`);
    }
  }
  for (const dir of ['evolution', 'indexes', 'logs']) {
    const target = join(paths.neuronDir, dir);
    if (await exists(target)) {
      await rm(target, { recursive: true, force: true });
      notes.push(`Removed unused .neuron/${dir}/`);
    }
  }
  return notes;
}

async function migrateFlatLayout(
  paths: BrainPaths,
  prefs: BrainPrefs | null,
  seed?: OpenProjectBrainOptions['seed'],
): Promise<{
  dna: ProjectDna;
  knowledge: KnowledgePlane;
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

  return { dna, knowledge, notes };
}

export async function openProjectBrain(
  projectRoot: string,
  options?: OpenProjectBrainOptions,
): Promise<ProjectBrain> {
  return ProjectBrain.open(projectRoot, options);
}
