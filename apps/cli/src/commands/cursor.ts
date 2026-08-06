import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isNeuronInitialized, neuronPaths, pathExists } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

/**
 * `neuron cursor` with no subcommand: tell the user exactly where Cursor wiring
 * stands and what to do next. Previously this printed "Unknown command".
 */
export async function runCursor(cwd = process.cwd()): Promise<void> {
  const paths = neuronPaths(cwd);
  const cursorDir = join(paths.root, '.cursor');
  const mcpPath = join(cursorDir, 'mcp.json');

  ui.title('Neuron + Cursor');
  ui.blank();

  if (!(await isNeuronInitialized(cwd))) {
    ui.warn('This project has no Project Brain yet.');
    ui.blank();
    ui.suggest('Run: neuron init');
    ui.info('  init detects the project, builds the brain, and wires Cursor in one step.');
    process.exitCode = 1;
    return;
  }

  const hasMcp = await pathExists(mcpPath);
  let registered = false;
  if (hasMcp) {
    try {
      const cfg = JSON.parse(await readFile(mcpPath, 'utf8')) as {
        mcpServers?: Record<string, unknown>;
      };
      registered = Boolean(cfg.mcpServers?.['neuron']);
    } catch {
      registered = false;
    }
  }

  const rules = await pathExists(join(cursorDir, 'rules', 'neuron-memory.mdc'));
  const skill = await pathExists(join(cursorDir, 'skills', 'neuron-memory', 'SKILL.md'));

  ui.kv('MCP server', registered ? `registered (${mcpPath})` : 'not registered');
  ui.kv('Agent rule', rules ? 'installed' : 'missing');
  ui.kv('Skill', skill ? 'installed' : 'missing');
  ui.blank();

  if (!registered || !rules || !skill) {
    ui.warn('Cursor wiring is incomplete.');
    ui.suggest('Run: neuron cursor setup --force');
    process.exitCode = 1;
    return;
  }

  ui.success('Cursor is wired up.');
  ui.blank();
  console.log('One manual step is required — Cursor keeps MCP servers off until you enable them:');
  ui.blank();
  ui.info('  1. Open Cursor Settings → Tools & MCP');
  ui.info('  2. Enable the "neuron" server');
  ui.info('  3. Start a chat and describe a task');
  ui.blank();
  console.log('The agent will load project context automatically. To check it end to end:');
  ui.blank();
  ui.info('  neuron cursor doctor');
}
