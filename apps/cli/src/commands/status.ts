import { access } from 'node:fs/promises';

import {
  isNeuronInitialized,
  loadLocalConfig,
  loadMetadata,
  neuronPaths,
  pathExists,
} from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { formatRelativeTime, ui } from '../ui/output.js';

export async function runStatus(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron Status');
  ui.blank();

  if (!(await isNeuronInitialized(cwd))) {
    ui.warn('Neuron is not initialized in this directory.');
    ui.suggest('Run: neuron init');
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
    // keep metadata count
  }

  const dbStatus = 'local FileStorageProvider (.neuron/) - no database required';

  const mcpConfigured = await pathExists(`${paths.root}/.cursor/mcp.json`);
  let mcpStatus = mcpConfigured ? 'Configured (.cursor/mcp.json)' : 'Not configured';
  try {
    await access(`${paths.root}/.cursor/mcp.json`);
    const { readFile } = await import('node:fs/promises');
    const mcp = JSON.parse(await readFile(`${paths.root}/.cursor/mcp.json`, 'utf8')) as {
      mcpServers?: Record<string, unknown>;
    };
    mcpStatus = mcp.mcpServers?.['neuron'] ? 'Connected (config present)' : 'Missing neuron entry';
  } catch {
    // keep default
  }

  console.log('Project:');
  ui.kv('Name', config.project.name);
  ui.kv('Id', config.project.id);
  ui.blank();
  console.log('Memories:');
  ui.kv('Count', String(memoryCount));
  ui.kv('Last sync', formatRelativeTime(meta.lastSyncAt));
  ui.kv('Last analyze', formatRelativeTime(meta.lastAnalyzeAt));
  ui.blank();
  console.log('Runtime:');
  ui.kv('Database', dbStatus);
  ui.kv('MCP', mcpStatus);
  ui.kv('Mode', config.server?.mode ?? 'local');
  ui.kv('Store', paths.store);
}
