import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createDocumentationAnalyzer } from '../analyzer/documentation-analyzer.js';
import { createDocumentationDriftDetector } from '../analyzer/drift-detector.js';
import { createDocumentationExporter } from '../exports/exporter.js';
import { createAPIAnalyzer } from '../generator/api-analyzer.js';
import { createArchitectureDocGenerator } from '../generator/architecture-doc.js';
import { createSmartChangelogGenerator } from '../generator/changelog.js';
import { createDecisionDocGenerator } from '../generator/decision-doc.js';
import { createModuleDocGenerator } from '../generator/module-doc.js';
import { createOnboardingGenerator } from '../generator/onboarding.js';
import { createDocumentationQualityScorer } from '../quality/score.js';
import { createDocumentationReviewer } from '../quality/reviewer.js';
import { createDocumentationSync } from '../sync/sync.js';
import type {
  ChangelogInput,
  DocumentationArtifact,
  DocumentationStoreDocument,
  DocumentationType,
  DriftFinding,
  ExportFormat,
  ModuleDocInput,
  ProjectBrainSnapshot,
} from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Living documentation facade — generates/syncs local docs; no wiki SaaS / hosting.
 */
export class DocumentationIntelligence {
  private artifacts: DocumentationArtifact[] = [];
  private drift: DriftFinding[] = [];

  private readonly analyzer = createDocumentationAnalyzer();
  private readonly driftDetector = createDocumentationDriftDetector();
  private readonly architecture = createArchitectureDocGenerator();
  private readonly modules = createModuleDocGenerator();
  private readonly onboarding = createOnboardingGenerator();
  private readonly api = createAPIAnalyzer();
  private readonly decisions = createDecisionDocGenerator();
  private readonly changelog = createSmartChangelogGenerator();
  private readonly quality = createDocumentationQualityScorer();
  private readonly reviewer = createDocumentationReviewer();
  private readonly sync = createDocumentationSync();
  private readonly exporter = createDocumentationExporter();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'documentation.json'), 'utf8'),
      ) as DocumentationStoreDocument;
      this.artifacts = raw.artifacts ?? [];
      this.drift = raw.drift ?? [];
    } catch {
      this.artifacts = [];
      this.drift = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'documentation.json');
    const health = this.docsHealth();
    const doc: DocumentationStoreDocument = {
      version: 1,
      artifacts: this.artifacts,
      drift: this.drift,
      lastHealth: health,
      updatedAt: nowIso(),
    };
    await writeFile(path, JSON.stringify(doc, null, 2), 'utf8');
    return path;
  }

  listArtifacts(): DocumentationArtifact[] {
    return [...this.artifacts];
  }

  detectDrift(input: {
    readme?: string;
    docsMarkdown?: string[];
    brain: ProjectBrainSnapshot;
  }): DriftFinding[] {
    const docFacts = [
      ...this.analyzer.extractFactsFromMarkdown(input.readme ?? '', 'README'),
      ...(input.docsMarkdown ?? []).flatMap((md, i) =>
        this.analyzer.extractFactsFromMarkdown(md, `docs[${i}]`),
      ),
    ];
    const brainFacts = this.analyzer.brainFacts(input.brain);
    this.drift = this.driftDetector.detect(docFacts, brainFacts);
    return [...this.drift];
  }

  generateDocs(brain: ProjectBrainSnapshot, options?: {
    includeModules?: boolean;
    includeDecisions?: boolean;
    includeOnboarding?: boolean;
    includeApiSnippets?: string[];
  }): DocumentationArtifact[] {
    const created: DocumentationArtifact[] = [];
    created.push(this.architecture.generate(brain));
    created.push({
      id: newId('doc'),
      type: 'PROJECT_OVERVIEW',
      source: 'generated',
      path: '.neuron/docs/overview.md',
      title: 'Project Overview',
      content: [
        `# ${brain.projectName ?? 'Project'} Overview`,
        '',
        `Modules: ${(brain.modules ?? []).join(', ') || 'Core'}`,
        '',
        `Stack: ${[...(brain.frameworks ?? []), ...(brain.databases ?? [])].join(', ') || 'n/a'}`,
        '',
        ...(brain.architectureNotes ?? []).map((n) => `- ${n}`),
        '',
      ].join('\n'),
      generatedFrom: ['project-brain'],
      lastUpdated: nowIso(),
      confidence: 0.7,
      status: 'CURRENT',
    });

    if (options?.includeOnboarding !== false) {
      created.push(this.onboarding.generate(brain));
    }

    if (options?.includeModules !== false && brain.modules?.length) {
      const mods: ModuleDocInput[] = brain.modules.map((name) => ({
        name,
        purpose: `${name} module`,
        responsibilities: [`Owns ${name} domain logic`],
        dependencies: brain.dependencies?.slice(0, 5),
        securityNotes: brain.securityNotes?.slice(0, 3),
        knownIssues: brain.incidents?.filter((i) => i.toLowerCase().includes(name.toLowerCase())),
        relatedDecisions: brain.decisions?.slice(0, 3),
      }));
      created.push(...this.modules.generateMany(mods));
    }

    if (options?.includeDecisions !== false && brain.decisions?.length) {
      created.push(...this.decisions.fromTexts(brain.decisions));
    }

    if (options?.includeApiSnippets?.length) {
      const routes = this.api.detectRoutes(options.includeApiSnippets);
      created.push(this.api.generateOverview(routes));
    }

    if (brain.securityNotes?.length) {
      created.push({
        id: newId('doc'),
        type: 'SECURITY_DOC',
        source: 'generated',
        path: '.neuron/docs/security.md',
        title: 'Security Notes',
        content: ['# Security Notes', '', ...brain.securityNotes.map((s) => `- ${s}`), ''].join(
          '\n',
        ),
        generatedFrom: ['security-intelligence'],
        lastUpdated: nowIso(),
        confidence: 0.65,
        status: 'CURRENT',
      });
    }

    this.mergeArtifacts(created);
    return created;
  }

  moduleDocs(input: ModuleDocInput | ModuleDocInput[]): DocumentationArtifact[] {
    const list = Array.isArray(input) ? input : [input];
    const created = this.modules.generateMany(list);
    this.mergeArtifacts(created);
    return created;
  }

  generateChangelog(input: ChangelogInput): DocumentationArtifact {
    const art = this.changelog.generate(input);
    this.mergeArtifacts([art]);
    return art;
  }

  explainProject(brain: ProjectBrainSnapshot): {
    summary: string;
    architecture: DocumentationArtifact;
    health: ReturnType<DocumentationIntelligence['docsHealth']>;
  } {
    const architecture = this.architecture.generate(brain);
    this.mergeArtifacts([architecture]);
    const summary = [
      `${brain.projectName ?? 'This project'} has modules: ${(brain.modules ?? ['Core']).join(', ')}.`,
      brain.databases?.length ? `Data stores: ${brain.databases.join(', ')}.` : '',
      brain.decisions?.length
        ? `Key decisions: ${brain.decisions.slice(0, 3).join('; ')}.`
        : 'No architecture decisions recorded yet.',
      this.drift.length
        ? `Documentation drift: ${this.drift.length} finding(s).`
        : 'No doc drift detected in this session.',
    ]
      .filter(Boolean)
      .join(' ');

    return { summary, architecture, health: this.docsHealth(brain.modules?.length) };
  }

  docsHealth(expectedModules?: number) {
    return this.reviewer.review({
      artifacts: this.artifacts,
      drift: this.drift,
      expectedModules,
    }).health;
  }

  review(expectedModules?: number) {
    return this.reviewer.review({
      artifacts: this.artifacts,
      drift: this.drift,
      expectedModules,
    });
  }

  async persistGenerated(neuronDir: string, types?: DocumentationType[]): Promise<string[]> {
    const selected = types?.length
      ? this.artifacts.filter((a) => types.includes(a.type))
      : this.artifacts.filter((a) => a.source === 'generated' || a.source === 'hybrid');
    const paths = await this.sync.writeAll(neuronDir, selected);
    await this.save(neuronDir);
    return paths;
  }

  exportArtifact(id: string, format: ExportFormat): string {
    const art = this.artifacts.find((a) => a.id === id);
    if (!art) throw new Error(`Unknown artifact: ${id}`);
    return this.exporter.export(art, format);
  }

  private mergeArtifacts(created: DocumentationArtifact[]): void {
    for (const art of created) {
      this.artifacts = [
        art,
        ...this.artifacts.filter((a) => !(a.type === art.type && a.path === art.path)),
      ];
    }
  }
}

export function createDocumentationIntelligence(): DocumentationIntelligence {
  return new DocumentationIntelligence();
}
