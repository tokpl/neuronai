import { describe, expect, it } from 'vitest';

import {
  createBrainSnapshot,
  createMemoryMaintenanceService,
  createNeuronBackupService,
} from '../src/index.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sample = {
  id: '1',
  projectId: 'p',
  type: 'knowledge' as const,
  title: 'Auth uses JWT',
  content: 'JWT with RBAC',
  importanceScore: 0.9,
  confidenceScore: 0.9,
  freshnessScore: 1,
  source: 'manual' as const,
  status: 'active' as const,
  version: 1,
  tags: [],
  usageCount: 0,
  lastUsedAt: null,
  embeddingId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('MemoryMaintenanceService', () => {
  it('detects near-duplicates', () => {
    const report = createMemoryMaintenanceService().analyze({
      memories: [
        sample,
        {
          ...sample,
          id: '2',
          title: 'Auth uses JWT',
          content: 'JWT with RBAC',
        },
      ],
      duplicateThreshold: 0.7,
    });
    expect(report.duplicatesFound).toBeGreaterThan(0);
    expect(report.archivedIds.length).toBeGreaterThan(0);
  });
});

describe('NeuronBackupService', () => {
  it('round-trips JSON export', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'neuron-backup-'));
    try {
      const svc = createNeuronBackupService();
      const snap = createBrainSnapshot({
        projectId: 'p',
        projectName: 'demo',
        memories: [sample],
      });
      const file = await svc.exportJson(snap, join(dir, 'brain.json'));
      const loaded = await svc.importJson(file);
      expect(loaded.memories).toHaveLength(1);
      const md = await svc.exportMarkdown(snap, join(dir, 'md'));
      const readme = await readFile(join(md, 'README.md'), 'utf8');
      expect(readme).toMatch(/demo/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
