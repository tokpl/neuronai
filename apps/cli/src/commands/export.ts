import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MemoryRecord } from '@neuron-ai-memory/types';

import { isNeuronInitialized, neuronPaths } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

function section(title: string, memories: MemoryRecord[]): string {
  const lines = [`# ${title}`, ''];
  if (memories.length === 0) {
    lines.push('_No entries yet._', '');
    return lines.join('\n');
  }
  for (const memory of memories) {
    lines.push(`## ${memory.title}`, '');
    lines.push(memory.content, '');
    lines.push(
      `- type: \`${memory.type}\` · importance: ${memory.importanceScore.toFixed(2)} · confidence: ${memory.confidenceScore.toFixed(2)}`,
      '',
    );
  }
  return lines.join('\n');
}

export async function runExport(cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const paths = neuronPaths(cwd);
  const session = await openProjectSession(cwd);
  const active = session.listMemories().filter((m) => m.status === 'active');

  await mkdir(paths.exportDir, { recursive: true });

  const architecture = active.filter(
    (m) => m.type === 'architecture_decision' || m.type === 'dependency',
  );
  const decisions = active.filter((m) => m.type === 'architecture_decision');
  const patterns = active.filter((m) => m.type === 'pattern' || m.type === 'knowledge');

  const files = [
    { name: 'architecture.md', body: section('Architecture', architecture) },
    { name: 'decisions.md', body: section('Decisions', decisions) },
    { name: 'patterns.md', body: section('Patterns & knowledge', patterns) },
  ];

  for (const file of files) {
    await writeFile(join(paths.exportDir, file.name), file.body, 'utf8');
  }

  ui.success(`Exported ${active.length} memories to ${paths.exportDir}`);
  for (const file of files) {
    ui.info(`  • ${file.name}`);
  }
}
