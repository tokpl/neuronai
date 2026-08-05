import { ProgressUI } from '../progress/progress-ui.js';
import { setupCursorIntegration } from '../services/cursor-setup.js';
import { pathExists } from '../services/neuron-fs.js';
import { join } from 'node:path';
import { ui } from '../ui/output.js';

/**
 * Wire Cursor: rules, MCP, connection check.
 */
export async function runCursorSetup(
  cwd = process.cwd(),
  options: { force?: boolean } = {},
): Promise<void> {
  ui.title('Neuron cursor setup');
  ui.blank();
  ui.info('Local-first Cursor integration — no cloud account.');
  ui.blank();

  const progress = new ProgressUI(3);
  progress.start('Writing Cursor rules…');
  const result = await setupCursorIntegration(cwd, options);
  progress.ok(`Rules → ${result.rulesPath}`);

  progress.start('Updating MCP configuration…');
  if (result.mcpValid) {
    progress.ok(`MCP → ${result.mcpPath}`);
  } else {
    progress.fail(`MCP validation failed: ${result.mcpErrors.join('; ')}`);
    process.exitCode = 1;
  }

  progress.start('Checking connection surface…');
  const neuronRule =
    (await pathExists(join(cwd, '.cursor', 'rules', 'neuron-memory.mdc'))) ||
    (await pathExists(join(cwd, '.cursor', 'rules', 'neuron.mdc')));
  if (neuronRule) {
    progress.ok('Cursor rules present');
  } else {
    progress.warn('Neuron rule file not found — try --force');
  }
  progress.done();

  ui.kv('Skill', result.skillPath);
  ui.kv('Commands', result.commandsDir);
  for (const w of result.mcpWarnings) {
    ui.warn(w);
  }
  if (!result.cursorDetected) {
    ui.warn('.cursor folder was created — open this project in Cursor to activate MCP.');
  }
  ui.blank();
  ui.suggest('Reload Cursor window / MCP, then run: neuron cursor doctor');
  ui.suggest('Ask Cursor: Analyze this project using Neuron');
}
