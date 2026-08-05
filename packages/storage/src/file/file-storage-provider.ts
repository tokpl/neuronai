import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { MemoryRecord } from '@neuron-ai-memory/types';

import type {
  NeuronBrain,
  NeuronDecisionsFile,
  NeuronKnowledgeFile,
  NeuronRulesFile,
  NeuronStoragePaths,
  StorageProvider,
  StorageStatus,
} from '../provider.js';

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
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function emptyKnowledge(): NeuronKnowledgeFile {
  return {
    version: 1,
    patterns: [],
    warnings: [],
    facts: [],
    other: [],
    updatedAt: new Date().toISOString(),
  };
}

function emptyDecisions(): NeuronDecisionsFile {
  return { version: 1, decisions: [], updatedAt: new Date().toISOString() };
}

function emptyRules(): NeuronRulesFile {
  return { version: 1, rules: [], updatedAt: new Date().toISOString() };
}

export function resolveNeuronPaths(projectRoot: string): NeuronStoragePaths {
  const root = resolve(projectRoot);
  const neuronDir = join(root, '.neuron');
  const runtimeDir = join(neuronDir, 'runtime');
  return {
    projectRoot: root,
    neuronDir,
    config: join(neuronDir, 'config.json'),
    brain: join(neuronDir, 'brain.json'),
    knowledge: join(neuronDir, 'knowledge.json'),
    decisions: join(neuronDir, 'decisions.json'),
    rules: join(neuronDir, 'rules.json'),
    graph: join(neuronDir, 'graph.json'),
    cacheDir: join(neuronDir, 'cache'),
    runtimeDir,
    indexesDir: join(neuronDir, 'indexes'),
    logsDir: join(neuronDir, 'logs'),
    store: join(runtimeDir, 'store.json'),
  };
}

/**
 * Local-first filesystem storage — the only MVP StorageProvider.
 * Versioned knowledge lives at `.neuron/*.json`; cache/runtime/indexes/logs are ephemeral.
 */
export class FileStorageProvider implements StorageProvider {
  readonly name = 'file';

  paths(projectRoot: string): NeuronStoragePaths {
    return resolveNeuronPaths(projectRoot);
  }

  async ensureLayout(projectRoot: string): Promise<void> {
    const p = this.paths(projectRoot);
    await mkdir(p.neuronDir, { recursive: true });
    await mkdir(p.cacheDir, { recursive: true });
    await mkdir(p.runtimeDir, { recursive: true });
    await mkdir(p.indexesDir, { recursive: true });
    await mkdir(p.logsDir, { recursive: true });

    if (!(await exists(p.knowledge))) await writeJson(p.knowledge, emptyKnowledge());
    if (!(await exists(p.decisions))) await writeJson(p.decisions, emptyDecisions());
    if (!(await exists(p.rules))) await writeJson(p.rules, emptyRules());
    if (!(await exists(p.graph))) {
      await writeJson(p.graph, { version: 1, nodes: [], edges: [], updatedAt: new Date().toISOString() });
    }
  }

  async migrateIfNeeded(projectRoot: string): Promise<{ migrated: boolean; notes: string[] }> {
    const p = this.paths(projectRoot);
    const notes: string[] = [];
    await this.ensureLayout(projectRoot);

    const legacyStore = join(p.neuronDir, 'data', 'store.json');
    const legacyGraph = join(p.neuronDir, 'data', 'graph.json');

    if ((await exists(legacyStore)) && !(await exists(p.store))) {
      await mkdir(p.runtimeDir, { recursive: true });
      await rename(legacyStore, p.store);
      notes.push('Moved data/store.json → runtime/store.json');
    } else if ((await exists(legacyStore)) && (await exists(p.store))) {
      notes.push('Legacy data/store.json present; runtime/store.json already exists — left legacy in place');
    }

    if ((await exists(legacyGraph)) && !(await exists(p.graph))) {
      await rename(legacyGraph, p.graph);
      notes.push('Moved data/graph.json → graph.json');
    }

    // Import curated markdown brain into JSON if JSON still empty
    const decisions = await this.readDecisions(projectRoot);
    if (decisions.decisions.length === 0 && (await exists(join(p.neuronDir, 'decisions.md')))) {
      notes.push('Legacy decisions.md detected — run neuron scan to refresh decisions.json');
    }

    // Seed brain.json from config if missing
    if (!(await exists(p.brain))) {
      try {
        const config = JSON.parse(await readFile(p.config, 'utf8')) as {
          project?: { id?: string; name?: string; stack?: string[] };
        };
        const brain: NeuronBrain = {
          version: 1,
          projectId: config.project?.id ?? 'local',
          name: config.project?.name ?? 'project',
          stack: config.project?.stack ?? [],
          summary: 'Migrated from legacy .neuron layout',
          updatedAt: new Date().toISOString(),
        };
        await this.writeBrain(projectRoot, brain);
        notes.push('Created brain.json from config.json');
      } catch {
        /* no config yet */
      }
    }

    return { migrated: notes.length > 0, notes };
  }

  async readBrain(projectRoot: string): Promise<NeuronBrain | undefined> {
    const p = this.paths(projectRoot);
    if (!(await exists(p.brain))) return undefined;
    return readJson<NeuronBrain | undefined>(p.brain, undefined);
  }

  async writeBrain(projectRoot: string, brain: NeuronBrain): Promise<void> {
    const p = this.paths(projectRoot);
    await mkdir(p.neuronDir, { recursive: true });
    await writeJson(p.brain, { ...brain, updatedAt: new Date().toISOString() });
  }

  async readKnowledge(projectRoot: string): Promise<NeuronKnowledgeFile> {
    return readJson(this.paths(projectRoot).knowledge, emptyKnowledge());
  }

  async writeKnowledge(projectRoot: string, knowledge: NeuronKnowledgeFile): Promise<void> {
    await writeJson(this.paths(projectRoot).knowledge, {
      ...knowledge,
      updatedAt: new Date().toISOString(),
    });
  }

  async readDecisions(projectRoot: string): Promise<NeuronDecisionsFile> {
    return readJson(this.paths(projectRoot).decisions, emptyDecisions());
  }

  async writeDecisions(projectRoot: string, decisions: NeuronDecisionsFile): Promise<void> {
    await writeJson(this.paths(projectRoot).decisions, {
      ...decisions,
      updatedAt: new Date().toISOString(),
    });
  }

  async readRules(projectRoot: string): Promise<NeuronRulesFile> {
    return readJson(this.paths(projectRoot).rules, emptyRules());
  }

  async writeRules(projectRoot: string, rules: NeuronRulesFile): Promise<void> {
    await writeJson(this.paths(projectRoot).rules, {
      ...rules,
      updatedAt: new Date().toISOString(),
    });
  }

  async syncFromMemories(projectRoot: string, memories: MemoryRecord[]): Promise<void> {
    const active = memories.filter((m) => m.status === 'active');
    const decisions = active.filter((m) => m.type === 'architecture_decision');
    const patterns = active.filter(
      (m) => m.type === 'knowledge' || m.type === 'pattern' || m.type === 'business_rule' || m.type === 'context',
    );
    const warnings = active.filter((m) => m.type === 'mistake');
    const facts = active.filter((m) => m.type === 'dependency');
    const used = new Set([...decisions, ...patterns, ...warnings, ...facts].map((m) => m.id));
    const other = active.filter((m) => !used.has(m.id));

    await this.writeDecisions(projectRoot, {
      version: 1,
      decisions,
      updatedAt: new Date().toISOString(),
    });
    await this.writeKnowledge(projectRoot, {
      version: 1,
      patterns,
      warnings,
      facts,
      other,
      updatedAt: new Date().toISOString(),
    });
  }

  async status(projectRoot: string): Promise<StorageStatus> {
    const p = this.paths(projectRoot);
    return {
      backend: this.name,
      ready: await exists(p.neuronDir),
      projectRoot: p.projectRoot,
      neuronDir: p.neuronDir,
      note: 'Local filesystem — no database or API key required',
    };
  }
}

export function createFileStorageProvider(): FileStorageProvider {
  return new FileStorageProvider();
}
