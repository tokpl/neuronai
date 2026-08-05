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
import { createInitialMemoryGenerator } from '../memory/generator.js';
import type { ProjectScanReport, ScanMode, ScanOptions } from '../types.js';
import { nowIso } from '../types.js';

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

    const maxFiles =
      mode === 'fast' ? 8_000 : mode === 'architecture' ? 20_000 : (options.maxDeepFiles ?? 50_000);

    const walk = await this.files.walk(root, { maxFiles, concurrency });
    let focusFiles = walk.files;

    if (mode === 'update') {
      const cache = options.previousCache ?? (await this.incremental.loadCache(neuronDir));
      const changed = this.incremental.changedFiles(walk.files, cache);
      focusFiles = changed.length
        ? changed
        : walk.files.filter((f) => f.importance === 'HIGH');
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
      stack,
      architecture,
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

    await this.incremental.saveCache(neuronDir, walk.files);

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
