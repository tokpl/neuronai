import { join } from 'node:path';

import { createContinuousProjectIntelligence } from '@neuron-ai-memory/project-intelligence';
import { createArchitectureDriftDetector } from '@neuron-ai-memory/project-intelligence';
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadIntel(runtime: NeuronRuntime) {
  const intel = createContinuousProjectIntelligence();
  await intel.load(neuronDir(runtime));
  return intel;
}

export async function handleProjectChanges(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  try {
    const intel = await loadIntel(runtime);
    await intel.analyzeLatestCommit(runtime.cwd).catch(() => null);
    const changes = intel.projectChanges(args.limit ?? 30);
    return okResult({
      ...changes,
      note: 'Local continuous intelligence — approval still required to store memories.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleDetectDrift(runtime: NeuronRuntime, _args: Record<string, unknown>) {
  try {
    const intel = await loadIntel(runtime);
    const detector = createArchitectureDriftDetector();
    const findings = [...intel.detectDrift()];

    // Light sample of controllers/services for live check
    const samples = await sampleSourceFiles(runtime.cwd, 40);
    for (const s of samples) {
      findings.push(...detector.inspect(s.path, s.content));
    }

    const unique = dedupeDrift(findings);
    for (const f of unique) {
      // record into state for pending suggestions
      intel.checkDrift(f.path, f.evidence);
    }
    await intel.save(neuronDir(runtime), runtime.cwd);

    return okResult({
      drift: unique.slice(0, 50),
      count: unique.length,
      note: 'Suggestions only — Neuron never auto-fixes architecture.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handlePendingMemories(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  try {
    const intel = await loadIntel(runtime);
    const pending = intel.pendingMemories().slice(0, args.limit ?? 50);
    return okResult({
      pending,
      count: pending.length,
      note: 'All items requireApproval=true.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleProjectHealthLive(
  runtime: NeuronRuntime,
  _args: Record<string, unknown>,
) {
  try {
    const intel = await loadIntel(runtime);
    await intel.analyzeLatestCommit(runtime.cwd).catch(() => null);
    const health = intel.liveHealth();
    const changes = intel.projectChanges(10);
    return okResult({
      health,
      recentHighChanges: changes.files.filter((f) => f.importance === 'HIGH').slice(0, 10),
      pendingMemories: intel.pendingMemories().length,
      openDrift: intel.detectDrift().length,
    });
  } catch (e) {
    return failResult(e);
  }
}

async function sampleSourceFiles(
  root: string,
  limit: number,
): Promise<Array<{ path: string; content: string }>> {
  const out: Array<{ path: string; content: string }> = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || out.length >= limit) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (['node_modules', '.git', 'dist', '.neuron'].includes(e.name)) continue;
      const abs = join(dir, e.name);
      const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
      if (e.isDirectory()) {
        await walk(abs, depth + 1);
        continue;
      }
      if (!/controller|service/i.test(e.name) || !/\.(ts|js)$/i.test(e.name)) continue;
      try {
        const content = await readFile(abs, 'utf8');
        out.push({ path: rel, content: content.slice(0, 40_000) });
      } catch {
        /* skip */
      }
      if (out.length >= limit) return;
    }
  }
  await walk(root, 0);
  return out;
}

function dedupeDrift<T extends { path: string; rule: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const i of items) {
    const k = `${i.path}|${i.rule}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}
