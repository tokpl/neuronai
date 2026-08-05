import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createPerformanceChangeAnalyzer } from '../analysis/change.js';
import { createPerformancePatternAnalyzer } from '../analysis/patterns.js';
import { createScalabilityAnalyzer } from '../analysis/scalability.js';
import { createAPIPerformanceAnalyzer } from '../backend/api-analyzer.js';
import { createDatabasePerformanceAnalyzer } from '../database/analyzer.js';
import { createFrontendPerformanceAnalyzer } from '../frontend/analyzer.js';
import { createBenchmarkBridge } from '../metrics/benchmark-bridge.js';
import { createScaleProfileStore } from '../metrics/scale-profile.js';
import { createOptimizationMemory } from '../patterns/optimization-memory.js';
import { createPerformanceReportGenerator } from '../reports/performance-report.js';
import type {
  PerformanceMemory,
  PerformanceMemoryType,
  PerformanceSeverity,
  PerformanceStatus,
  PerformanceStoreDocument,
  ProjectScaleProfile,
} from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Performance Intelligence facade — advises on scalability; never APM / prod / auto-deploy.
 */
export class PerformanceIntelligence {
  private memories: PerformanceMemory[] = [];
  private readonly patterns = createPerformancePatternAnalyzer();
  private readonly database = createDatabasePerformanceAnalyzer();
  private readonly api = createAPIPerformanceAnalyzer();
  private readonly frontend = createFrontendPerformanceAnalyzer();
  private readonly scalability = createScalabilityAnalyzer();
  private readonly change = createPerformanceChangeAnalyzer();
  private readonly optimizations = createOptimizationMemory();
  private readonly profile = createScaleProfileStore();
  private readonly benchmarks = createBenchmarkBridge();
  private readonly reports = createPerformanceReportGenerator();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'performance.json'), 'utf8'),
      ) as PerformanceStoreDocument;
      this.memories = raw.memories ?? [];
      this.optimizations.load(raw.optimizations ?? []);
      if (raw.profile) this.profile.load(raw.profile);
      this.benchmarks.load(raw.benchmarks ?? []);
    } catch {
      this.memories = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'performance.json');
    const doc: PerformanceStoreDocument = {
      version: 1,
      memories: this.memories,
      optimizations: this.optimizations.list(),
      profile: this.profile.get(),
      benchmarks: this.benchmarks.list(),
      updatedAt: nowIso(),
    };
    await writeFile(path, JSON.stringify(doc, null, 2), 'utf8');
    return path;
  }

  async writeReport(neuronDir: string, markdown: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'performance-report.md');
    await writeFile(path, markdown, 'utf8');
    return path;
  }

  listMemories(): PerformanceMemory[] {
    return [...this.memories];
  }

  remember(input: {
    type: PerformanceMemoryType;
    description: string;
    impact: string;
    severity?: PerformanceSeverity;
    confidence?: number;
    affectedModules?: string[];
    solution?: string | null;
    recommendation?: string;
    relatedIncidentIds?: string[];
  }): PerformanceMemory {
    const now = nowIso();
    const mem: PerformanceMemory = {
      id: newId('pm'),
      type: input.type,
      description: input.description,
      impact: input.impact,
      severity: input.severity ?? 'MEDIUM',
      confidence: input.confidence ?? 0.7,
      affectedModules: input.affectedModules ?? [],
      solution: input.solution ?? null,
      status: 'OPEN',
      recommendation: input.recommendation,
      relatedIncidentIds: input.relatedIncidentIds,
      createdAt: now,
      updatedAt: now,
    };
    this.memories.unshift(mem);
    return mem;
  }

  resolveMemory(
    id: string,
    solution: string,
    status: PerformanceStatus = 'OPTIMIZED',
  ): PerformanceMemory {
    const mem = this.memories.find((m) => m.id === id);
    if (!mem) throw new Error(`Unknown performance memory: ${id}`);
    mem.solution = solution;
    mem.status = status;
    mem.updatedAt = nowIso();
    return mem;
  }

  performanceHistory(query?: string): PerformanceMemory[] {
    if (!query?.trim()) return this.listMemories();
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    return this.memories.filter((m) => {
      const hay = `${m.type} ${m.description} ${m.impact} ${m.affectedModules.join(' ')}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
  }

  listOptimizations() {
    return this.optimizations.list();
  }

  searchOptimizations(query: string) {
    return this.optimizations.search(query);
  }

  updateScaleProfile(input: Partial<Omit<ProjectScaleProfile, 'updatedAt'>>): ProjectScaleProfile {
    return this.profile.update(input);
  }

  recordOptimization(input: {
    problem: string;
    solution: string;
    result: string;
    module?: string;
    beforeMetric?: string;
    afterMetric?: string;
  }) {
    const rec = this.optimizations.remember(input);
    this.benchmarks.fromOptimization(rec);
    return rec;
  }

  performanceContext(input: {
    query: string;
    snippets?: string[];
    filePaths?: string[];
    modules?: string[];
    dependencyNotes?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
  }) {
    const patternFindings = this.patterns.analyze({
      snippets: input.snippets,
      filePaths: input.filePaths,
    });
    const dbFindings = this.database.analyze({ snippets: input.snippets });
    const related = this.performanceHistory(input.query).slice(0, 10);
    const opts = this.optimizations.search(input.query).slice(0, 5);
    const incidentHits = (input.previousIncidents ?? [])
      .filter((i) =>
        overlap(
          `${input.query} checkout slow database`.toLowerCase(),
          `${i.title} ${i.description ?? ''}`.toLowerCase(),
        ) >= 1 || /slow|timeout|n\+1|query|performance|latency/i.test(`${i.title} ${i.description ?? ''}`),
      )
      .slice(0, 8);

    const bottlenecks = [...patternFindings, ...dbFindings]
      .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
      .slice(0, 12);

    const risks = [
      ...bottlenecks.filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL').map((f) => f.title),
      ...incidentHits.map((i) => `Prior incident: ${i.title}`),
    ];

    return {
      query: input.query,
      existingPatterns: patternFindings,
      knownBottlenecks: bottlenecks,
      risks,
      recommendations: [
        ...bottlenecks.map((f) => f.recommendation),
        ...opts.map((o) => `Past fix: ${o.solution} → ${o.result}`),
      ].slice(0, 15),
      relatedPerformanceMemories: related,
      relatedIncidents: incidentHits,
      priorOptimizations: opts,
      scaleProfile: this.profile.get(),
      note: 'Neuron advises on performance — it does not profile production or auto-deploy fixes.',
    };
  }

  review(input: {
    snippets?: string[];
    filePaths?: string[];
    modules?: string[];
    dependencies?: Array<{ from: string; to: string }>;
    dependencyNotes?: string[];
    migrations?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
    writeMemories?: boolean;
  }) {
    const findings = [
      ...this.patterns.analyze({ snippets: input.snippets, filePaths: input.filePaths }),
      ...this.database.analyze({
        snippets: input.snippets,
        migrations: input.migrations,
      }),
      ...this.api.analyze({ snippets: input.snippets }),
      ...this.frontend.analyze({ snippets: input.snippets, filePaths: input.filePaths }),
    ];

    const scalability = this.scalability.analyze({
      modules: input.modules,
      dependencies: input.dependencies,
      notes: input.dependencyNotes,
    });

    const relatedIncidents = (input.previousIncidents ?? [])
      .filter((i) => /slow|perf|timeout|n\+1|query|latency|load/i.test(`${i.title} ${i.description ?? ''}`))
      .map((i) => ({ id: i.id, title: i.title }))
      .slice(0, 10);

    if (input.writeMemories !== false) {
      for (const f of findings.filter((x) => x.severity !== 'LOW')) {
        this.remember({
          type: f.type,
          description: f.title,
          impact: f.detail,
          severity: f.severity,
          confidence: f.confidence,
          recommendation: f.recommendation,
          relatedIncidentIds: relatedIncidents.map((i) => i.id),
        });
      }
    }

    return {
      findings,
      scalability,
      memories: this.listMemories().slice(0, 30),
      profile: this.profile.get(),
      optimizations: this.optimizations.list().slice(0, 20),
      relatedIncidents,
      note: 'Neuron is a performance advisor — not an APM and not auto-deploy.',
    };
  }

  scalabilityCheck(input: {
    modules?: string[];
    dependencies?: Array<{ from: string; to: string }>;
    notes?: string[];
  }) {
    return this.scalability.analyze(input);
  }

  databaseReview(input: { snippets?: string[]; migrations?: string[]; schemaNotes?: string[] }) {
    return this.database.analyze(input);
  }

  checkChange(input: { diff?: string; changedPaths?: string[] }) {
    return this.change.analyze(input);
  }

  buildReport(input: {
    overview?: string;
    snippets?: string[];
    filePaths?: string[];
    modules?: string[];
    dependencyNotes?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
  }) {
    const review = this.review({ ...input, writeMemories: false });
    return this.reports.markdown({
      overview: input.overview,
      review,
      previousIncidents: input.previousIncidents,
    });
  }

  compareBenchmark(label: string) {
    return this.benchmarks.compare(label);
  }

  recordBenchmark(
    phase: 'before' | 'after',
    label: string,
    metrics: Record<string, number | string>,
    notes?: string[],
  ) {
    return phase === 'before'
      ? this.benchmarks.recordBefore(label, metrics, notes)
      : this.benchmarks.recordAfter(label, metrics, notes);
  }
}

function overlap(a: string, b: string): number {
  const ta = new Set(a.split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  let n = 0;
  for (const t of b.split(/[^a-z0-9]+/)) if (ta.has(t)) n += 1;
  return n;
}

function sevRank(s: PerformanceSeverity): number {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[s];
}

export function createPerformanceIntelligence(): PerformanceIntelligence {
  return new PerformanceIntelligence();
}
