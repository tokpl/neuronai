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
  let lastSyncAt = meta.lastSyncAt;
  let brainExplain = '';
  try {
    const session = await openProjectSession(cwd);
    const active = session.listMemories();
    memoryCount = active.length;
    const newest = active
      .map((m) => m.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (newest) lastSyncAt = newest;
    brainExplain = session.brain.explain();
    const s = session.brain.status();
    console.log('Project Brain:');
    ui.kv('Health', `${s.healthPercent}%`);
    ui.kv('DNA', s.dnaUpdated ? 'Updated' : 'Missing');
    ui.kv('Knowledge', s.knowledgeUpdated ? 'Updated' : 'Empty');
    ui.kv('Decisions', String(s.decisionCount));
    ui.blank();
  } catch {
    // keep metadata count
  }

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
  ui.kv('Last sync', formatRelativeTime(lastSyncAt));
  ui.kv('Last analyze', formatRelativeTime(meta.lastAnalyzeAt));
  ui.blank();
  console.log('Storage:');
  ui.kv('Brain', `${paths.brainDir} (commit this)`);
  ui.kv('Runtime', `${paths.runtimeDir} (regenerable)`);
  ui.kv('Cursor MCP', mcpStatus);
  if (brainExplain) {
    ui.blank();
    ui.info(brainExplain);
  }
}
