import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { MemoryRecord, MemoryRelationRecord, MemoryVersionRecord } from '@neuron-ai-memory/types';

export interface NeuronBrainSnapshot {
  version: 1;
  kind: 'neuron-brain';
  exportedAt: string;
  projectId: string;
  projectName?: string;
  memories: MemoryRecord[];
  versions?: MemoryVersionRecord[];
  relations?: MemoryRelationRecord[];
  graph?: { nodes: unknown[]; edges: unknown[] };
}

export interface BackupPaths {
  jsonPath: string;
  markdownDir: string;
}

/**
 * Export / import project "brain" snapshots (JSON + Markdown).
 * Database dump format is documented for operators (pg_dump) — not embedded here.
 */
export class NeuronBackupService {
  async exportJson(snapshot: NeuronBrainSnapshot, outPath: string): Promise<string> {
    await mkdir(join(outPath, '..'), { recursive: true }).catch(() => undefined);
    const dir = outPath.endsWith('.json') ? join(outPath, '..') : outPath;
    await mkdir(dir, { recursive: true });
    const file = outPath.endsWith('.json') ? outPath : join(dir, 'brain.json');
    await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    return file;
  }

  async exportMarkdown(snapshot: NeuronBrainSnapshot, outDir: string): Promise<string> {
    await mkdir(outDir, { recursive: true });
    const byType = new Map<string, MemoryRecord[]>();
    for (const m of snapshot.memories.filter((x) => x.status === 'active')) {
      const list = byType.get(m.type) ?? [];
      list.push(m);
      byType.set(m.type, list);
    }
    for (const [type, memories] of byType) {
      const lines = [`# ${type}`, '', `Exported: ${snapshot.exportedAt}`, ''];
      for (const m of memories) {
        lines.push(`## ${m.title}`, '', m.content, '', `importance: ${m.importanceScore}`, '');
      }
      await writeFile(join(outDir, `${type}.md`), lines.join('\n'), 'utf8');
    }
    await writeFile(
      join(outDir, 'README.md'),
      `# Neuron brain export\n\nProject: ${snapshot.projectName ?? snapshot.projectId}\nMemories: ${snapshot.memories.length}\n`,
      'utf8',
    );
    return outDir;
  }

  async importJson(path: string): Promise<NeuronBrainSnapshot> {
    const raw = JSON.parse(await readFile(path, 'utf8')) as NeuronBrainSnapshot;
    if (raw.kind !== 'neuron-brain' || raw.version !== 1) {
      throw new Error('Invalid Neuron brain snapshot');
    }
    return raw;
  }

  /**
   * Destructive local purge helper — deletes a directory tree (e.g. `.neuron`).
   */
  async purgeDirectory(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }
}

export function createNeuronBackupService(): NeuronBackupService {
  return new NeuronBackupService();
}

export function createBrainSnapshot(input: {
  projectId: string;
  projectName?: string;
  memories: MemoryRecord[];
  versions?: MemoryVersionRecord[];
  relations?: MemoryRelationRecord[];
  graph?: { nodes: unknown[]; edges: unknown[] };
}): NeuronBrainSnapshot {
  return {
    version: 1,
    kind: 'neuron-brain',
    exportedAt: new Date().toISOString(),
    projectId: input.projectId,
    projectName: input.projectName,
    memories: input.memories,
    versions: input.versions,
    relations: input.relations,
    graph: input.graph,
  };
}
