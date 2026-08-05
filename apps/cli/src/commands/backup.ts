import { join } from 'node:path';

import {
  createBrainSnapshot,
  createMemoryMaintenanceService,
  createNeuronBackupService,
} from '@neuron-ai-memory/ops';
import { createAccessControl } from '@neuron-ai-memory/security';

import {
  isNeuronInitialized,
  loadLocalConfig,
  neuronPaths,
} from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

export async function runBackup(
  cwd = process.cwd(),
  options: { format?: 'json' | 'markdown' | 'both' } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const acl = createAccessControl();
  acl.assert('memory:export');

  const format = options.format ?? 'both';
  const config = await loadLocalConfig(cwd);
  const session = await openProjectSession(cwd);
  const paths = neuronPaths(cwd);
  const backupDir = join(paths.neuronDir, 'backup', new Date().toISOString().replace(/[:.]/g, '-'));

  const snapshot = createBrainSnapshot({
    projectId: config.project.id,
    projectName: config.project.name,
    memories: session.listMemories(),
  });

  const svc = createNeuronBackupService();
  ui.title('Neuron backup');

  if (format === 'json' || format === 'both') {
    const file = await svc.exportJson(snapshot, join(backupDir, 'brain.json'));
    ui.success(`JSON → ${file}`);
  }
  if (format === 'markdown' || format === 'both') {
    const dir = await svc.exportMarkdown(snapshot, join(backupDir, 'markdown'));
    ui.success(`Markdown → ${dir}`);
  }

  ui.info('Database dump (optional): pg_dump "$DATABASE_URL" > neuron.sql');
  ui.suggest('Restore later with: neuron restore <path-to-brain.json>');
}

export async function runRestore(jsonPath: string, cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    process.exitCode = 1;
    return;
  }
  createAccessControl().assert('memory:write');

  const svc = createNeuronBackupService();
  const snapshot = await svc.importJson(jsonPath);
  const session = await openProjectSession(cwd);

  let imported = 0;
  for (const memory of snapshot.memories) {
    try {
      await session.engine.createMemory({
        projectId: session.project.projectId,
        type: memory.type,
        title: memory.title,
        content: memory.content,
        source: memory.source,
        tags: [...memory.tags, 'restored'],
        manualImportance: memory.importanceScore,
        confidence: memory.confidenceScore,
      });
      imported += 1;
    } catch {
      // skip duplicates
    }
  }

  ui.success(`Restored ${imported} memories from snapshot (${snapshot.memories.length} in file)`);
}

export async function runPurge(
  cwd = process.cwd(),
  options: { force?: boolean } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.warn('Nothing to purge — Neuron is not initialized.');
    return;
  }
  createAccessControl().assert('project:purge');

  if (!options.force) {
    ui.warn('This deletes .neuron/ for the current project.');
    ui.suggest('Re-run with --force to confirm: neuron purge --force');
    process.exitCode = 1;
    return;
  }

  const paths = neuronPaths(cwd);
  await createNeuronBackupService().purgeDirectory(paths.neuronDir);
  ui.success(`Purged ${paths.neuronDir}`);
}

export async function runMaintain(cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    process.exitCode = 1;
    return;
  }
  createAccessControl().assert('memory:read');

  const session = await openProjectSession(cwd);
  const report = createMemoryMaintenanceService().analyze({
    memories: session.listMemories(),
  });

  ui.title('Neuron maintain');
  ui.kv('Duplicates', String(report.duplicatesFound));
  ui.kv('Stale', String(report.staleFound));
  ui.kv('Orphans', String(report.orphanRelations));
  ui.kv('Archive candidates', String(report.archivedIds.length));
  for (const tip of report.recommendations.slice(0, 10)) {
    ui.info(`  • ${tip}`);
  }
  if (report.archivedIds.length) {
    ui.suggest('Review candidates; archive via MCP neuron_update_memory / future maintain --apply');
  } else {
    ui.success('No maintenance actions suggested.');
  }
}
