import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  isNeuronInitialized,
  loadLocalConfig,
  loadMetadata,
  neuronPaths,
  pathExists,
} from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

/**
 * Explain the project brain in plain language (local files + memories).
 */
export async function runExplain(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron explain');
  ui.blank();

  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const config = await loadLocalConfig(cwd);
  const meta = await loadMetadata(cwd);
  const paths = neuronPaths(cwd);

  let memoryCount = meta.memoryCount;
  try {
    const session = await openProjectSession(cwd);
    memoryCount = session.listMemories().filter((m) => m.status === 'active').length;
  } catch {
    // keep metadata
  }

  console.log('This project:');
  ui.kv('Name', config.project.name);
  ui.kv('Stack', config.project.stack.slice(0, 12).join(', ') || 'unknown');
  ui.kv('Memories', String(memoryCount));
  ui.kv(
    'Privacy',
    `localOnly=${config.privacy.localOnly !== false}, telemetry=${config.privacy.telemetry ? 'ON' : 'OFF'}`,
  );
  ui.blank();

  const archPath = join(paths.neuronDir, 'architecture.md');
  if (await pathExists(archPath)) {
    console.log('Architecture summary:');
    const md = await readFile(archPath, 'utf8');
    const excerpt = md.split('\n').slice(0, 40).join('\n');
    console.log(excerpt);
    if (md.split('\n').length > 40) {
      ui.info('… (see .neuron/architecture.md for full map)');
    }
  } else {
    ui.warn('No architecture.md yet.');
    ui.suggest('Run: neuron scan');
  }

  ui.blank();
  ui.suggest('Deeper context for a task: neuron optimize-context "<task>" --explain');
  ui.suggest('Full report: neuron project-report');
}
