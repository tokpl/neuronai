import { join } from 'node:path';

import { createSecurityIntelligence } from '@neuron-ai-memory/security-intelligence';
import { createDebugIntelligence } from '@neuron-ai-memory/debug-intelligence';
import {
  createProjectConstitutionService,
} from '@neuron-ai-memory/project-constitution';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadSecurity(runtime: NeuronRuntime) {
  const sec = createSecurityIntelligence();
  await sec.load(neuronDir(runtime));
  return sec;
}

async function relatedIncidents(runtime: NeuronRuntime, query: string) {
  try {
    const dbg = createDebugIntelligence();
    await dbg.load(neuronDir(runtime));
    return dbg.searchIncidents(query).map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
    }));
  } catch {
    return [];
  }
}

async function securityRules(runtime: NeuronRuntime): Promise<string[]> {
  try {
    const svc = createProjectConstitutionService({
      neuronDir: neuronDir(runtime),
      projectId: runtime.project.projectId,
      projectName: runtime.project.name,
      projectRoot: runtime.cwd,
    });
    const { document } = await svc.getRules();
    const active = document.rules
      .filter((r) => r.category === 'SECURITY' && (r.status === 'active' || r.status === 'approved'))
      .map((r) => r.rule);
    if (active.length) return active;
  } catch {
    /* fall through */
  }
  return createSecurityIntelligence().defaultSecurityRules().map((r) => r.rule);
}

async function architectureNotes(runtime: NeuronRuntime): Promise<string[]> {
  try {
    const hits = await runtime.searchEngine.search({
      projectId: runtime.project.projectId,
      query: 'architecture security auth',
      limit: 8,
    });
    return hits.map((h) => `${h.memory.title}: ${h.memory.content}`);
  } catch {
    return [];
  }
}

export async function handleSecurityContext(
  runtime: NeuronRuntime,
  args: { query: string; filePaths?: string[] },
) {
  try {
    const sec = await loadSecurity(runtime);
    const result = sec.securityContext({
      query: args.query,
      filePaths: args.filePaths,
      architectureNotes: await architectureNotes(runtime),
      securityRules: await securityRules(runtime),
      previousIncidents: await relatedIncidents(runtime, args.query),
    });
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleSecurityReview(
  runtime: NeuronRuntime,
  args: {
    mode?: 'QUICK' | 'DEEP' | 'CHANGE';
    query?: string;
    diff?: string;
    changedPaths?: string[];
    files?: Array<{ path: string; content: string }>;
    writeReport?: boolean;
  },
) {
  try {
    const sec = await loadSecurity(runtime);
    const incidents = await relatedIncidents(runtime, args.query ?? 'security');
    const review = sec.review({
      mode: args.mode ?? 'QUICK',
      files: args.files,
      diff: args.diff,
      changedPaths: args.changedPaths,
      architectureNotes: await architectureNotes(runtime),
      securityRules: await securityRules(runtime),
      previousIncidents: incidents,
    });
    let reportPath: string | undefined;
    if (args.writeReport !== false) {
      const md = sec.buildReport({
        overview: args.query,
        architectureNotes: await architectureNotes(runtime),
        mode: args.mode === 'CHANGE' ? 'CHANGE' : 'DEEP',
        files: args.files,
        previousIncidents: incidents,
      });
      reportPath = await sec.writeReport(neuronDir(runtime), md);
    }
    await sec.save(neuronDir(runtime));
    return okResult({
      review,
      reportPath,
      note: review.note,
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleThreatModel(
  runtime: NeuronRuntime,
  args: {
    modules?: string[];
    entryPoints?: string[];
    assets?: string[];
  },
) {
  try {
    const sec = await loadSecurity(runtime);
    const model = sec.threatModel({
      modules: args.modules,
      entryPoints: args.entryPoints,
      assets: args.assets,
      architectureNotes: await architectureNotes(runtime),
    });
    return okResult({ threatModel: model });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleSecurityHistory(
  runtime: NeuronRuntime,
  args: { query?: string },
) {
  try {
    const sec = await loadSecurity(runtime);
    const memories = sec.securityHistory(args.query);
    return okResult({ memories, count: memories.length });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleCheckChangeSecurity(
  runtime: NeuronRuntime,
  args: {
    diff?: string;
    changedPaths?: string[];
    modules?: string[];
  },
) {
  try {
    const sec = await loadSecurity(runtime);
    const impact = sec.checkChangeSecurity({
      diff: args.diff,
      changedPaths: args.changedPaths,
      modules: args.modules,
      securityRules: await securityRules(runtime),
      previousIncidents: await relatedIncidents(
        runtime,
        `${args.diff ?? ''} ${(args.changedPaths ?? []).join(' ')}`,
      ),
    });
    for (const f of impact.findings) {
      sec.remember({
        type: f.type,
        description: f.description,
        severity: f.severity,
        confidence: f.confidence,
        affectedModules: f.affectedModules,
        recommendation: f.recommendation ?? undefined,
        relatedIncidentIds: impact.relatedIncidents.map((x) => x.split(':')[0]!).filter(Boolean),
      });
    }
    await sec.save(neuronDir(runtime));
    return okResult({ impact });
  } catch (e) {
    return failResult(e);
  }
}
