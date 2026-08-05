import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createBoundaryAnalyzer } from '../analysis/boundary-analyzer.js';
import {
  createComplexityAnalyzer,
  type ComplexityInput,
} from '../analysis/complexity-analyzer.js';
import { createDependencyAnalyzer } from '../analysis/dependency-analyzer.js';
import { createPatternDetector } from '../analysis/pattern-detector.js';
import {
  createArchitectureDiff,
  createArchitectureHealthScorer,
} from '../metrics/health-score.js';
import { buildRecommendations } from '../recommendations/recommendations.js';
import {
  renderArchitectureHealthReport,
  writeArchitectureHealthReport,
} from '../reports/architecture-health.js';
import { createRefactoringPlanner } from '../refactoring/refactoring-planner.js';
import { createTechnicalDebtMemory } from '../refactoring/technical-debt.js';
import { createArchitectureRuleEngine } from '../rules/rule-engine.js';
import type {
  ArchitectureBoundary,
  ArchitectureDiffResult,
  ArchitectureHealthScore,
  ArchitectureReviewStoreDocument,
  ArchitectureRisk,
  ArchitectureSnapshot,
  DependencyEdge,
  ModuleNode,
  RefactoringPlan,
} from '../types.js';
import { newId, nowIso } from '../types.js';

export interface ArchitectureScanInput {
  modules: ModuleNode[];
  dependencies: DependencyEdge[];
  boundaries?: ArchitectureBoundary[];
  complexity?: ComplexityInput[];
  label?: string;
  testCoverage?: number;
  documentation?: number;
  security?: number;
}

export interface ArchitectureScanResult {
  snapshot: ArchitectureSnapshot;
  score: ArchitectureHealthScore;
  dependencyGraph: {
    nodes: string[];
    edges: DependencyEdge[];
    circular: Array<{ cycle: string[]; warning: string }>;
  };
  plans: RefactoringPlan[];
  recommendations: ReturnType<typeof buildRecommendations>;
  reportMarkdown: string;
  issues: string[];
  risks: ArchitectureRisk[];
}

/**
 * Architecture audit engine — analyzes and proposes, never auto-rewrites.
 */
export class ArchitectureReviewEngine {
  readonly dependencies = createDependencyAnalyzer();
  readonly boundaries = createBoundaryAnalyzer();
  readonly complexity = createComplexityAnalyzer();
  readonly patterns = createPatternDetector();
  readonly rules = createArchitectureRuleEngine();
  readonly planner = createRefactoringPlanner();
  readonly debt = createTechnicalDebtMemory();
  readonly scorer = createArchitectureHealthScorer();
  readonly diff = createArchitectureDiff();

  private snapshots: ArchitectureSnapshot[] = [];
  private lastScore?: ArchitectureHealthScore;

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'architecture-review.json'), 'utf8'),
      ) as ArchitectureReviewStoreDocument;
      this.snapshots = raw.snapshots ?? [];
      this.debt.load(raw.debt ?? []);
      this.lastScore = raw.lastScore;
    } catch {
      this.snapshots = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const doc: ArchitectureReviewStoreDocument = {
      version: 1,
      snapshots: this.snapshots.slice(0, 20),
      debt: this.debt.snapshot(),
      lastScore: this.lastScore,
      updatedAt: nowIso(),
    };
    const path = join(neuronDir, 'architecture-review.json');
    await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return path;
  }

  scan(input: ArchitectureScanInput): ArchitectureScanResult {
    this.complexity.reset();
    const dep = this.dependencies.analyze(input.modules, input.dependencies);
    const boundaryFindings = this.boundaries.analyze(
      input.modules,
      input.boundaries ?? [],
    );
    const complexityFindings = this.complexity.analyze(input.complexity ?? []);
    const ruleViolations = this.rules.evaluate({
      modules: input.modules,
      edges: input.dependencies,
    });
    const detectedPatterns = this.patterns.detect(input.modules);

    const risks: ArchitectureRisk[] = [
      ...dep.circular.map((c) => ({
        id: newId('risk'),
        severity: 'high' as const,
        title: 'Circular dependency',
        detail: c.warning,
        location: c.cycle.join(' → '),
      })),
      ...dep.coupling
        .filter((c) => c.highCoupling)
        .map((c) => ({
          id: newId('risk'),
          severity: 'medium' as const,
          title: 'High coupling',
          detail: `${c.moduleId} fanIn=${c.fanIn} fanOut=${c.fanOut}`,
          location: c.moduleId,
        })),
      ...boundaryFindings.map((b) => ({
        id: newId('risk'),
        severity: 'medium' as const,
        title: 'Boundary issue',
        detail: b.issue,
        location: b.moduleId,
      })),
      ...ruleViolations.map((v) => ({
        id: newId('risk'),
        severity: v.severity,
        title: `Rule: ${v.ruleId}`,
        detail: v.message,
        location: v.location,
      })),
    ];

    const snapshot: ArchitectureSnapshot = {
      modules: input.modules,
      dependencies: input.dependencies,
      boundaries: input.boundaries ?? [],
      patterns: detectedPatterns,
      risks,
      timestamp: nowIso(),
      label: input.label,
    };

    const score = this.scorer.score({
      coupling: dep.coupling,
      complexity: complexityFindings,
      ruleViolations,
      circularCount: dep.circular.length,
      boundaryIssueCount: boundaryFindings.length,
      testCoverage: input.testCoverage,
      documentation: input.documentation,
      security: input.security,
    });

    const plans = this.planner.planAll({
      circular: dep.circular,
      boundaries: boundaryFindings,
      complexity: complexityFindings,
      rules: ruleViolations,
    });

    for (const p of plans.slice(0, 15)) {
      this.debt.record({
        issue: p.problem,
        impact: p.impact,
        location: p.location ?? 'unknown',
        priority: p.estimatedEffort === 'XL' || p.estimatedEffort === 'L' ? 'P1' : 'P2',
      });
    }

    const recommendations = buildRecommendations({
      score,
      plans,
      circularCount: dep.circular.length,
    });

    const strengths: string[] = [];
    if (detectedPatterns.includes('repository')) strengths.push('Repository pattern detected');
    if (detectedPatterns.includes('dependency_injection')) {
      strengths.push('Dependency injection cues present');
    }
    if (score.score >= 80) strengths.push('Overall architecture health is strong');
    if (!dep.circular.length) strengths.push('No circular dependencies detected');

    const problems = [
      ...dep.circular.map((c) => c.warning),
      ...boundaryFindings.map((b) => b.issue),
      ...complexityFindings.slice(0, 5).map((c) => c.detail),
      ...ruleViolations.map((v) => v.message),
      ...dep.unusedModules.map((u) => `Unused module: ${u}`),
    ];

    const reportMarkdown = renderArchitectureHealthReport({
      overview: `Scanned ${input.modules.length} modules, ${input.dependencies.length} edges. Patterns: ${detectedPatterns.join(', ')}.`,
      score,
      strengths,
      problems,
      risks,
      recommendations: recommendations.map((r) => `${r.title}: ${r.detail}`),
      plans,
    });

    this.snapshots.unshift(snapshot);
    this.snapshots = this.snapshots.slice(0, 20);
    this.lastScore = score;

    return {
      snapshot,
      score,
      dependencyGraph: {
        nodes: input.modules.map((m) => m.id),
        edges: input.dependencies,
        circular: dep.circular,
      },
      plans,
      recommendations,
      reportMarkdown,
      issues: problems,
      risks,
    };
  }

  /**
   * Cursor "Architecture Review" / Review this refactor.
   */
  review(input: ArchitectureScanInput): ArchitectureScanResult {
    return this.scan(input);
  }

  refactorPlan(input: ArchitectureScanInput): RefactoringPlan[] {
    return this.scan(input).plans;
  }

  architectureScore(input: ArchitectureScanInput): ArchitectureHealthScore {
    return this.scan(input).score;
  }

  dependencyGraph(input: ArchitectureScanInput) {
    return this.scan(input).dependencyGraph;
  }

  compareLast(after: ArchitectureScanInput): ArchitectureDiffResult | undefined {
    const previous = this.snapshots[0];
    const result = this.scan(after);
    if (!previous || !this.lastScore) return undefined;
    const beforeScore = this.scorer.score({
      coupling: this.dependencies.analyze(previous.modules, previous.dependencies).coupling,
      complexity: [],
      ruleViolations: this.rules.evaluate({
        modules: previous.modules,
        edges: previous.dependencies,
      }),
      circularCount: previous.risks.filter((r) => /circular/i.test(r.title)).length,
    });
    return this.diff.compare(previous, result.snapshot, {
      before: beforeScore,
      after: result.score,
    });
  }

  getLastScore(): ArchitectureHealthScore | undefined {
    return this.lastScore;
  }

  async writeReport(neuronDir: string, scan: ArchitectureScanResult): Promise<string> {
    return writeArchitectureHealthReport(neuronDir, {
      overview: `Scanned ${scan.snapshot.modules.length} modules.`,
      score: scan.score,
      strengths: scan.recommendations
        .filter((r) => r.priority === 'low')
        .map((r) => r.title),
      problems: scan.issues,
      risks: scan.risks,
      recommendations: scan.recommendations.map((r) => `${r.title}: ${r.detail}`),
      plans: scan.plans,
    });
  }
}

/** Demo / default Neuron monorepo-shaped modules for empty scans */
export function defaultNeuronModules(): {
  modules: ModuleNode[];
  dependencies: DependencyEdge[];
} {
  const modules: ModuleNode[] = [
    { id: 'core', name: 'core-framework', layer: 'core', responsibilities: ['lifecycle', 'DI container'] },
    { id: 'memory', name: 'memory-engine', layer: 'other', responsibilities: ['memory'] },
    { id: 'storage', name: 'storage', layer: 'storage', responsibilities: ['persistence abstraction'] },
    { id: 'security', name: 'security-core', layer: 'security', responsibilities: ['sanitization', 'MCP guard'] },
    { id: 'mcp', name: 'mcp-server', layer: 'application', responsibilities: ['tools', 'handlers'] },
    { id: 'decision', name: 'decision-engine', layer: 'other', responsibilities: ['recommendations'] },
  ];
  const dependencies: DependencyEdge[] = [
    { from: 'mcp', to: 'memory', kind: 'module' },
    { from: 'mcp', to: 'decision', kind: 'module' },
    { from: 'mcp', to: 'security', kind: 'module' },
    { from: 'memory', to: 'storage', kind: 'module' },
    { from: 'security', to: 'storage', kind: 'module' },
    { from: 'core', to: 'memory', kind: 'module' },
  ];
  return { modules, dependencies };
}

export function createArchitectureReviewEngine(): ArchitectureReviewEngine {
  return new ArchitectureReviewEngine();
}
