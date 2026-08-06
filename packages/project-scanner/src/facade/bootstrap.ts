import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { createArchitectureAnalyzer } from '../architecture/analyzer.js';
import { createCodeRelationshipAnalyzer } from '../architecture/relationships.js';
import { createProjectBrainWriter, renderProjectReport } from '../brain/writer.js';
import { createDependencyGraphBuilder } from '../dependencies/graph.js';
import { createDocumentationAnalyzer } from '../documentation/analyzer.js';
import { createCodebaseScanner } from '../filesystem/scanner.js';
import { createTechnologyDetector } from '../frameworks/technology.js';
import { createGitAnalyzer } from '../git/analyzer.js';
import { createIncrementalScanner } from '../incremental/scanner.js';
import { buildProjectMap } from '../map/builder.js';
import { createInitialMemoryGenerator } from '../memory/generator.js';
import { extractSymbols } from '../symbols/extractor.js';
import type {
  ArchitectureMap,
  ProjectMapSnapshot,
  ProjectScanReport,
  ProjectStackProfile,
  ScanCacheEntry,
  ScanDelta,
  ScanMode,
  ScanOptions,
} from '../types.js';
import { nowIso } from '../types.js';

const EMPTY_STACK: ProjectStackProfile = {
  frontend: [],
  backend: [],
  database: [],
  tools: [],
  languages: [],
  packageManagers: [],
  manifests: [],
};

const EMPTY_ARCHITECTURE: ArchitectureMap = {
  modules: [],
  services: [],
  controllers: [],
  repositories: [],
  components: [],
  routes: [],
  databaseLayers: [],
  middleware: [],
  entrypoints: [],
  markdown: '',
};

const EMPTY_MAP: ProjectMapSnapshot = {
  version: 1,
  updatedAt: nowIso(),
  entries: [],
};

/** An `update` scan where nothing changed. Reported honestly, costs nothing. */
function unchangedReport(
  projectName: string,
  filesScanned: number,
  filesSkipped: number,
  delta: ScanDelta,
): ProjectScanReport {
  return {
    projectName,
    mode: 'update',
    scannedAt: nowIso(),
    filesScanned,
    filesSkipped,
    modules: 0,
    services: 0,
    dependencies: 0,
    memoriesCreated: 0,
    relationships: 0,
    rulesSuggested: 0,
    unchanged: true,
    delta,
    stack: EMPTY_STACK,
    architecture: EMPTY_ARCHITECTURE,
    map: EMPTY_MAP,
    dependencyGraph: [],
    relationshipsList: [],
    memories: [],
    suggestedRules: [],
    git: { commitsSampled: 0, authors: [], branches: [], potentialDecisions: [] },
    docs: { readmeSummary: null, docFiles: [], knowledgeBullets: [] },
    markdown: 'No files changed since the last scan.',
    architectureMarkdown: '',
    constitutionMarkdown: '',
    cursorRulesMarkdown: '',
  };
}

/**
 * Full project brain bootstrap engine.
 */
export class ProjectBrainBootstrap {
  private readonly files = createCodebaseScanner();
  private readonly tech = createTechnologyDetector();
  private readonly deps = createDependencyGraphBuilder();
  private readonly arch = createArchitectureAnalyzer();
  private readonly relations = createCodeRelationshipAnalyzer();
  private readonly git = createGitAnalyzer();
  private readonly docs = createDocumentationAnalyzer();
  private readonly memories = createInitialMemoryGenerator();
  private readonly brain = createProjectBrainWriter();
  private readonly incremental = createIncrementalScanner();

  async scan(options: ScanOptions): Promise<ProjectScanReport> {
    const mode: ScanMode = options.mode ?? 'fast';
    const root = options.root;
    const projectName = options.projectName ?? basename(root);
    const neuronDir = join(root, '.neuron');
    const concurrency = options.concurrency ?? 16;

    // Keep fast and update on the same corpus ceiling so an incremental pass
    // cannot "discover" files a truncated fast scan never cached.
    const maxFiles =
      mode === 'fast' || mode === 'update'
        ? 20_000
        : mode === 'architecture'
          ? 20_000
          : (options.maxDeepFiles ?? 50_000);

    const walk = await this.files.walk(root, { maxFiles, concurrency });
    let focusFiles = walk.files;
    const previousCache: ScanCacheEntry[] =
      options.previousCache ?? (await this.incremental.loadCache(neuronDir));
    let delta: ScanDelta | undefined =
      previousCache.length > 0
        ? this.incremental.computeDelta(walk.files, previousCache)
        : undefined;

    if (mode === 'update') {
      delta =
        delta ??
        ({
          added: walk.files.map((f) => f.relativePath),
          changed: [],
          deleted: [],
          unchanged: 0,
          reanalyzed: walk.files.length,
        } satisfies ScanDelta);

      // Nothing moved since the last scan: re-deriving the same facts would only
      // burn time and produce identical output.
      if (previousCache.length > 0 && this.incremental.unchanged(walk.files, previousCache)) {
        return unchangedReport(projectName, walk.files.length, walk.skipped, {
          ...delta,
          reanalyzed: 0,
        });
      }

      // Re-analyze only added/changed files. Deleted paths are handled by map
      // rebuild + scan-memory invalidation in the runtime. Do NOT fall back to
      // every HIGH file — under src/ that is effectively the whole repo.
      const focusPaths = new Set([...delta.added, ...delta.changed]);
      focusFiles = walk.files.filter((f) => focusPaths.has(f.relativePath));
      delta = { ...delta, reanalyzed: focusFiles.length };
    } else if (delta) {
      // Full scans re-analyze the focus set (HIGH/symbols), not every file.
      delta = { ...delta, reanalyzed: focusFiles.length };
    }

    const stack = await this.tech.detect(root);
    const dependencyGraph = mode === 'architecture' ? [] : await this.deps.build(root, stack);
    const architecture = this.arch.analyze(walk.files);

    const relationshipsList =
      mode === 'deep' || mode === 'architecture' || mode === 'update'
        ? await this.relations.analyze(focusFiles, {
            maxFiles: mode === 'architecture' ? 250 : 400,
            concurrency,
          })
        : [];

    // Fast scan still gets export/route hints from HIGH files — locations are
    // the highest-leverage knowledge for "where is X?".
    // On update, only touch focusFiles so unchanged files are not re-read.
    const symbolHints = await extractSymbols(focusFiles, {
      maxFiles: mode === 'fast' ? 80 : mode === 'update' ? Math.min(200, focusFiles.length || 1) : 200,
      concurrency,
    });
    const relationshipsForMap = [...relationshipsList, ...symbolHints];

    const gitInsight = await this.git.analyze(root);
    const docInsight =
      mode === 'architecture'
        ? { readmeSummary: null, docFiles: [], knowledgeBullets: [] as string[] }
        : await this.docs.analyze(root, walk.files);

    const generated = this.memories.generate({
      stack,
      architecture,
      dependencyGraph,
      git: gitInsight,
      docs: docInsight,
    });
    const suggestedRules = this.memories.suggestRules({ architecture, stack });
    const constitutionMarkdown = this.brain.buildConstitutionMarkdown(projectName, suggestedRules);
    const cursorRulesMarkdown = this.brain.buildCursorRules(stack, suggestedRules);

    const map = buildProjectMap({
      files: walk.files,
      architecture,
      relationships: relationshipsForMap,
      manifests: stack.manifests,
    });

    const report: ProjectScanReport = {
      projectName,
      mode,
      scannedAt: nowIso(),
      filesScanned: walk.files.length,
      filesSkipped: walk.skipped,
      modules: architecture.modules.length,
      services: architecture.services.length,
      dependencies: dependencyGraph.length,
      memoriesCreated: generated.length,
      relationships: relationshipsList.length,
      rulesSuggested: suggestedRules.length,
      delta,
      stack,
      architecture,
      map,
      dependencyGraph,
      relationshipsList,
      memories: generated,
      suggestedRules,
      git: gitInsight,
      docs: docInsight,
      markdown: '',
      architectureMarkdown: architecture.markdown,
      constitutionMarkdown,
      cursorRulesMarkdown,
    };
    report.markdown = renderProjectReport(report);

    await this.brain.write(neuronDir, {
      projectName,
      stack,
      architecture,
      dependencyGraph,
      memories: generated,
      suggestedRules,
      reportMarkdown: report.markdown,
      architectureMarkdown: architecture.markdown,
      constitutionMarkdown,
    });

    await this.incremental.saveCache(neuronDir, walk.files, previousCache);

    try {
      const rulesDir = join(root, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });
      await writeFile(join(rulesDir, 'project-patterns.mdc'), cursorRulesMarkdown, 'utf8');
    } catch {
      /* optional */
    }

    return report;
  }
}

export function createProjectBrainBootstrap(): ProjectBrainBootstrap {
  return new ProjectBrainBootstrap();
}
