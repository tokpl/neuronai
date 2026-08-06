import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  brainDocs,
  facet,
  findDuplicate,
  memoryDocs,
  prepareContext,
  retrieve,
  type PreparedContext,
  type ProjectBrain,
  type RetrievalDoc,
  type RetrievalHit,
} from '@neuronai/brain';
import { loadConfig, type NeuronConfig } from '@neuronai/config';
import type { MemoryEngine } from '@neuronai/memory-engine';
import { createProjectResolver, type ResolvedProject } from '@neuronai/project-analyzer';
import {
  createProjectBrainBootstrap,
  mergeCodeIntelligence,
  type ProjectScanReport,
  type ScanMode,
} from '@neuronai/project-scanner';
import type { MemoryRecord, MemoryType } from '@neuronai/types';

import {
  createLocalFileMemoryStack,
  type LocalFileMemoryStack,
} from './local/create-local-file-stack.js';
import { listStaleScanMemories } from './scan-invalidation.js';

/**
 * The one way to construct a working Neuron.
 *
 * CLI and MCP both call this; neither builds its own brain, engine or searcher.
 * Persistence lives in ProjectBrain, ranking in @neuronai/brain retrieval,
 * prompt shaping in the brain compiler. This module only wires them together.
 */
export interface NeuronRuntime {
  cwd: string;
  config: NeuronConfig;
  project: ResolvedProject;
  brain: ProjectBrain;
  engine: MemoryEngine;
  stack: LocalFileMemoryStack;
  /** Active memory records for this project. */
  listMemories: () => MemoryRecord[];
  /** Every retrievable document: engine memories plus durable brain knowledge. */
  corpus: () => RetrievalDoc[];
  /** Ranked search across the whole corpus. */
  search: (query: string, limit?: number) => RetrievalHit[];
  /** Retrieval + compression in one pass — the single context path. */
  context: (input: { task: string; mode?: string; modules?: string[] }) => PreparedContext;
  /** Analyze the codebase and fold what it learns into the brain. */
  scan: (mode?: ScanMode) => Promise<ScanOutcome>;
  persist: () => Promise<void>;
  /** Duplicates collapsed during the most recent persist. */
  lastDuplicatesRemoved: number;
}

export interface ScanOutcome {
  report: ProjectScanReport;
  memoriesStored: number;
  duplicatesSkipped: number;
  /** Scan-derived memories archived because their evidence paths disappeared. */
  staleMemoriesRemoved: number;
}

export interface CreateRuntimeOptions {
  cwd?: string;
  /** Called after every persist, so adapters can update their own metadata. */
  onPersist?: (runtime: NeuronRuntime) => Promise<void>;
}

export async function createNeuronRuntime(
  options: CreateRuntimeOptions = {},
): Promise<NeuronRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig({ optional: true, cwd });
  const project = await createProjectResolver().resolve(cwd);
  const stack = await createLocalFileMemoryStack(cwd);

  const listMemories = (): MemoryRecord[] =>
    stack.memories
      .exportRecords()
      .filter((m) => m.projectId === project.projectId && m.status === 'active');

  const corpus = (): RetrievalDoc[] => {
    const docs = memoryDocs(listMemories());
    const seen = new Set(docs.map((d) => d.id));
    // Brain knowledge that is not mirrored from the engine (rules, DNA summary).
    for (const doc of brainDocs({ knowledge: runtime.brain.knowledge, dna: runtime.brain.dna })) {
      if (!seen.has(doc.id)) docs.push(doc);
    }
    return docs;
  };

  const search = (query: string, limit = 10): RetrievalHit[] =>
    retrieve(query, corpus(), { limit }).hits;

  // The engine's searcher is the same ranking used everywhere else.
  stack.setSearcher({
    async search(input) {
      const hits = retrieve(input.query, memoryDocs(listMemories()), {
        limit: input.limit ?? 10,
      }).hits;
      const byId = new Map(listMemories().map((m) => [m.id, m]));
      return {
        results: hits
          .map((hit) => ({ memory: byId.get(hit.doc.id), score: hit.score }))
          .filter((r): r is { memory: MemoryRecord; score: number } => Boolean(r.memory)),
      };
    },
  });

  const persist = async (): Promise<void> => {
    const outcome = await stack.persist();
    runtime.lastDuplicatesRemoved = outcome.duplicatesRemoved;
    await options.onPersist?.(runtime);
  };

  const engine: MemoryEngine = {
    createMemory: async (input) => {
      const memory = await stack.engine.createMemory(input);
      await persist();
      return memory;
    },
    getMemory: (id) => stack.engine.getMemory(id),
    searchMemory: (input) => stack.engine.searchMemory(input),
    updateMemory: async (input) => {
      const memory = await stack.engine.updateMemory(input);
      await persist();
      return memory;
    },
    archiveMemory: async (id) => {
      await stack.engine.archiveMemory(id);
      await persist();
    },
    createMemoryVersion: async (input) => {
      const version = await stack.engine.createMemoryVersion(input);
      await persist();
      return version;
    },
    createRelation: async (input) => {
      const relation = await stack.engine.createRelation(input);
      await persist();
      return relation;
    },
    getProjectMemoryContext: (input) => stack.engine.getProjectMemoryContext(input),
  };

  /**
   * Run the scanner and fold everything it learns into the brain: generated
   * memories become searchable, modules become DNA, relationships become the graph.
   * Previously the scan wrote a JSON file that nothing read.
   */
  const scan = async (mode: ScanMode = 'fast'): Promise<ScanOutcome> => {
    const report = await createProjectBrainBootstrap().scan({
      root: cwd,
      mode,
      projectName: project.name,
    });

    // An unchanged incremental scan carries no findings. Applying it would
    // overwrite the existing DNA and graph with empty values.
    if (report.unchanged) {
      return { report, memoriesStored: 0, duplicatesSkipped: 0, staleMemoriesRemoved: 0 };
    }

    const brain = stack.brain;
    const deletedPaths = new Set(
      (report.delta?.deleted ?? []).map((p) => p.replace(/\\/g, '/')),
    );
    const pathGone = (path: string): boolean => {
      const p = path.replace(/\\/g, '/');
      if (deletedPaths.has(p)) return true;
      for (const d of deletedPaths) {
        const dPrefix = d.endsWith('/') ? d : `${d}/`;
        if (p === d || p.startsWith(dPrefix)) return true;
        // Module dirs (`src/billing/`) die when any file under them is deleted.
        if (p.endsWith('/') && d.startsWith(p)) return true;
      }
      return false;
    };

    const pathStillOnDisk = (path: string): boolean => {
      const rel = path.replace(/\\/g, '/').replace(/\/$/, '');
      return existsSync(join(cwd, rel)) || existsSync(join(cwd, path.replace(/\\/g, '/')));
    };

    // Live evidence = map paths + architecture file lists + manifests.
    // On update, prior map entries for untouched paths still count as live.
    const livePaths = new Set<string>([
      ...report.map.entries.map((e) => e.path),
      ...report.architecture.routes,
      ...report.architecture.services,
      ...report.architecture.repositories,
      ...report.architecture.controllers,
      ...report.architecture.databaseLayers,
      ...report.architecture.middleware,
      ...report.architecture.entrypoints,
      ...report.stack.manifests,
      ...report.docs.docFiles,
    ]);
    if (mode === 'update') {
      for (const entry of brain.getMap().entries ?? []) {
        if (!pathGone(entry.path) && pathStillOnDisk(entry.path)) livePaths.add(entry.path);
      }
    }

    let staleMemoriesRemoved = 0;
    for (const stale of listStaleScanMemories(listMemories(), livePaths)) {
      await stack.engine.archiveMemory(stale.id);
      staleMemoriesRemoved += 1;
    }

    let memoriesStored = 0;
    let duplicatesSkipped = 0;

    const ingest = async (input: {
      type: MemoryType;
      title: string;
      content: string;
      confidence: number;
      tags: string[];
      paths?: string[];
    }): Promise<void> => {
      if (findDuplicate(input, listMemories())) {
        duplicatesSkipped += 1;
        return;
      }
      await stack.engine.createMemory({
        projectId: project.projectId,
        type: input.type,
        title: input.title,
        content: input.content,
        source: 'git',
        tags: input.tags,
        manualImportance: input.confidence,
        confidence: input.confidence,
        paths: input.paths,
      });
      memoriesStored += 1;
    };

    for (const generated of report.memories) {
      await ingest({
        type: generated.type,
        title: generated.title,
        content: generated.content,
        confidence: generated.confidence,
        tags: ['scan', ...generated.tags],
        paths: generated.paths,
      });
    }

    // Conventions the scanner inferred. These previously only reached
    // .neuron/constitution.md, so "what conventions should I follow?" found nothing.
    for (const rule of report.suggestedRules) {
      await ingest({
        type: 'business_rule',
        title: rule.rule,
        content: `${rule.rule}. ${rule.reason} (convention inferred from the codebase — review before treating as binding.)`,
        confidence: rule.confidence,
        tags: ['scan', 'convention'],
      });
    }

    // A one-line summary — never a markdown dump, this is shown in `neuron status`.
    const topModules = report.architecture.modules.slice(0, 6).join(', ');
    brain.seedIdentity({
      projectId: project.projectId,
      name: project.name,
      stack: project.stack,
      summary: [
        `${report.modules} modules across ${report.filesScanned} files`,
        topModules ? `(${topModules})` : '',
        project.stack.length ? `· ${project.stack.slice(0, 4).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });

    const evidence = [
      { kind: 'scan', note: `${report.mode} scan of ${report.filesScanned} files` },
    ];
    brain.dna.structure.modules = facet(report.architecture.modules, {
      confidence: 0.85,
      source: 'detect',
      evidence,
    });
    brain.dna.structure.entryPoints = facet(report.architecture.routes.slice(0, 20), {
      confidence: 0.7,
      source: 'detect',
      evidence,
    });
    if (report.stack.languages.length) {
      brain.dna.stack.language = facet(report.stack.languages[0] ?? 'unknown', {
        confidence: 0.9,
        source: 'detect',
        evidence,
      });
    }

    const focusTouched =
      (report.delta?.added.length ?? 0) + (report.delta?.changed.length ?? 0) > 0;

    // Incremental updates may only re-analyze a focus set. Keep prior graph edges
    // for untouched files instead of wiping them when relationshipsList is empty.
    const nextEdges =
      mode === 'update' && report.relationshipsList.length === 0 && !focusTouched
        ? ((brain.knowledge.graph.edges ?? []) as Array<{ from: string; to: string; type?: string }>).filter(
            (e) => !pathGone(e.from) && !pathGone(String(e.to)),
          )
        : report.relationshipsList.map((rel) => ({
            from: rel.fromFile,
            to: rel.toModule,
            type: rel.kind,
          }));

    await brain.updateGraph({
      nodes: report.architecture.modules.map((name) => ({
        id: `module:${name}`,
        name,
        type: 'MODULE',
      })),
      edges: nextEdges,
    });

    // Locations must be queryable — never leave scan findings only in markdown.
    // On update, retain prior map entries for live paths so symbols from
    // untouched files survive a delete-only or tiny focus pass.
    let mapEntries = report.map.entries;
    if (mode === 'update') {
      const prior = brain.getMap().entries ?? [];
      const merged = new Map<string, (typeof mapEntries)[number]>();
      for (const entry of prior) {
        if (pathGone(entry.path) || !pathStillOnDisk(entry.path)) continue;
        merged.set(`${entry.kind}:${entry.path}:${entry.name}`, entry);
      }
      for (const entry of report.map.entries) {
        merged.set(`${entry.kind}:${entry.path}:${entry.name}`, entry);
      }
      mapEntries = [...merged.values()].slice(0, 400);
    }

    await brain.updateMap({
      version: 1,
      updatedAt: report.map.updatedAt,
      entries: mapEntries,
    });

    // Structural code intelligence — merge on update so unchanged files keep verified edges.
    if (report.code) {
      const priorCode = brain.getCode();
      const nextCode =
        mode === 'update'
          ? mergeCodeIntelligence(priorCode, report.code, {
              deletedPaths: report.delta?.deleted ?? [],
              replacedPaths: [...(report.delta?.added ?? []), ...(report.delta?.changed ?? [])],
            })
          : report.code;
      // Drop nodes whose paths no longer exist on disk (rename safety).
      const liveCode = {
        ...nextCode,
        files: nextCode.files.filter((f) => pathStillOnDisk(f.path)),
        symbols: nextCode.symbols.filter((s) => pathStillOnDisk(s.path)),
        edges: nextCode.edges.filter(
          (e) =>
            pathStillOnDisk(e.from.split('#')[0]!) && pathStillOnDisk(e.to.split('#')[0]!),
        ),
      };
      await brain.updateCode(liveCode);
    }

    if (report.stack.database[0]) {
      brain.dna.platforms.data = facet(report.stack.database[0], {
        confidence: 0.85,
        source: 'detect',
        evidence,
      });
    }
    if (report.stack.packageManagers[0]) {
      brain.dna.stack.packageManager = facet(report.stack.packageManagers[0], {
        confidence: 0.9,
        source: 'detect',
        evidence,
      });
    }
    if (report.stack.backend[0] || report.stack.frontend[0]) {
      brain.dna.stack.framework = facet(report.stack.backend[0] ?? report.stack.frontend[0]!, {
        confidence: 0.8,
        source: 'detect',
        evidence,
      });
    }

    await persist();
    return { report, memoriesStored, duplicatesSkipped, staleMemoriesRemoved };
  };

  const runtime: NeuronRuntime = {
    cwd,
    config,
    project,
    brain: stack.brain,
    engine,
    stack,
    listMemories,
    corpus,
    search,
    context: (input) =>
      prepareContext({
        ...input,
        docs: corpus(),
        code: stack.brain.getCode(),
      }),
    scan,
    persist,
    lastDuplicatesRemoved: 0,
  };

  return runtime;
}
