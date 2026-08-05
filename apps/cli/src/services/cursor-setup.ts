import { resolve } from 'node:path';

import {
  installCursorIntegration,
  runCursorDoctorChecks,
  writeProjectBrainFiles,
} from '@neuronai/cursor-integration';
import type { MemoryRecord } from '@neuronai/types';

import {
  isNeuronInitialized,
  loadLocalConfig,
  neuronPaths,
} from './neuron-fs.js';
import { openProjectSession } from './project-session.js';

function pickByType(
  memories: MemoryRecord[],
  types: string[],
  limit: number,
): Array<{ title: string; content: string }> {
  return memories
    .filter((m) => m.status === 'active' && types.includes(m.type))
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, limit)
    .map((m) => ({ title: m.title, content: m.content }));
}

export async function syncProjectBrainFiles(cwd = process.cwd()): Promise<void> {
  const paths = neuronPaths(cwd);
  if (!(await isNeuronInitialized(cwd))) return;

  const config = await loadLocalConfig(cwd);
  const session = await openProjectSession(cwd);
  const memories = session.listMemories();

  await writeProjectBrainFiles(paths.neuronDir, {
    projectId: config.project.id,
    projectName: config.project.name,
    stack: config.project.stack,
    architectureNotes: memories
      .filter((m) => m.type === 'architecture_decision' || m.type === 'dependency')
      .slice(0, 12)
      .map((m) => m.title),
    decisions: pickByType(memories, ['architecture_decision'], 20),
    patterns: pickByType(memories, ['pattern', 'knowledge'], 20),
    warnings: pickByType(memories, ['mistake'], 20),
  });
}

export async function setupCursorIntegration(
  cwd = process.cwd(),
  options: { force?: boolean } = {},
) {
  const root = resolve(cwd);
  return installCursorIntegration(root, options);
}

export async function diagnoseCursor(cwd = process.cwd()) {
  return runCursorDoctorChecks(resolve(cwd));
}
