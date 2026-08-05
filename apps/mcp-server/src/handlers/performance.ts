import { join } from 'node:path';

import { createPerformanceIntelligence } from '@neuron-ai-memory/performance-intelligence';
import { createDebugIntelligence } from '@neuron-ai-memory/debug-intelligence';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadPerf(runtime: NeuronRuntime) {
  const perf = createPerformanceIntelligence();
  await perf.load(neuronDir(runtime));
  return perf;
}

async function relatedIncidents(runtime: NeuronRuntime, query: string) {
  try {
    const dbg = createDebugIntelligence();
    await dbg.load(neuronDir(runtime));
    const seen = new Set<string>();
    const out: Array<{ id: string; title: string; description?: string }> = [];
    for (const q of [query, 'slow', 'timeout', 'query', 'performance', 'n+1', 'checkout']) {
      for (const i of dbg.searchIncidents(q)) {
        if (seen.has(i.id)) continue;
        seen.add(i.id);
        out.push({ id: i.id, title: i.title, description: i.description });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function handlePerformanceContext(
  runtime: NeuronRuntime,
  args: {
    query: string;
    snippets?: string[];
    filePaths?: string[];
    modules?: string[];
  },
) {
  try {
    const perf = await loadPerf(runtime);
    const result = perf.performanceContext({
      query: args.query,
      snippets: args.snippets,
      filePaths: args.filePaths,
      modules: args.modules,
      previousIncidents: await relatedIncidents(runtime, args.query),
    });
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handlePerformanceReview(
  runtime: NeuronRuntime,
  args: {
    query?: string;
    snippets?: string[];
    filePaths?: string[];
    modules?: string[];
    dependencyNotes?: string[];
    dependencies?: Array<{ from: string; to: string }>;
    writeReport?: boolean;
  },
) {
  try {
    const perf = await loadPerf(runtime);
    const incidents = await relatedIncidents(runtime, args.query ?? 'performance');
    const review = perf.review({
      snippets: args.snippets,
      filePaths: args.filePaths,
      modules: args.modules,
      dependencyNotes: args.dependencyNotes,
      dependencies: args.dependencies,
      previousIncidents: incidents,
    });
    let reportPath: string | undefined;
    if (args.writeReport !== false) {
      const md = perf.buildReport({
        overview: args.query ?? 'Performance review',
        snippets: args.snippets,
        filePaths: args.filePaths,
        modules: args.modules,
        dependencyNotes: args.dependencyNotes,
        previousIncidents: incidents,
      });
      reportPath = await perf.writeReport(neuronDir(runtime), md);
    }
    await perf.save(neuronDir(runtime));
    return okResult({ review, reportPath, note: review.note });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleScalabilityCheck(
  runtime: NeuronRuntime,
  args: {
    modules?: string[];
    dependencies?: Array<{ from: string; to: string }>;
    notes?: string[];
  },
) {
  try {
    const perf = await loadPerf(runtime);
    const warnings = perf.scalabilityCheck(args);
    return okResult({ warnings, count: warnings.length });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleDatabaseReview(
  runtime: NeuronRuntime,
  args: {
    snippets?: string[];
    migrations?: string[];
    schemaNotes?: string[];
  },
) {
  try {
    const perf = await loadPerf(runtime);
    const findings = perf.databaseReview(args);
    for (const f of findings.filter((x) => x.severity === 'HIGH' || x.severity === 'CRITICAL')) {
      perf.remember({
        type: 'DATABASE',
        description: f.title,
        impact: f.detail,
        severity: f.severity,
        confidence: f.confidence,
        recommendation: f.recommendation,
      });
    }
    await perf.save(neuronDir(runtime));
    return okResult({ findings });
  } catch (e) {
    return failResult(e);
  }
}

export async function handlePerformanceHistory(
  runtime: NeuronRuntime,
  args: { query?: string },
) {
  try {
    const perf = await loadPerf(runtime);
    const memories = perf.performanceHistory(args.query);
    return okResult({
      memories,
      optimizations: args.query
        ? perf.searchOptimizations(args.query)
        : perf.listOptimizations(),
      count: memories.length,
    });
  } catch (e) {
    return failResult(e);
  }
}
