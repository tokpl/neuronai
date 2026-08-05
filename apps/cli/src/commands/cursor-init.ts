import { setupCursorIntegration, syncProjectBrainFiles } from '../services/cursor-setup.js';
import { isNeuronInitialized, loadLocalConfig, neuronPaths } from '../services/neuron-fs.js';
import { runInit } from './init.js';
import { ui } from '../ui/output.js';

/**
 * Full Cursor bootstrap: Neuron project (if needed) + MCP/rules/skills/commands + project brain files.
 */
export async function runCursorInit(
  cwd = process.cwd(),
  options: { force?: boolean; skipAnalyze?: boolean } = {},
): Promise<void> {
  ui.title('Neuron init cursor');
  ui.blank();

  if (!(await isNeuronInitialized(cwd)) || options.force) {
    await runInit(cwd, { force: options.force, skipAnalyze: options.skipAnalyze });
  } else {
    ui.success('Neuron already initialized — refreshing Cursor wiring…');
    const cursor = await setupCursorIntegration(cwd, { force: true });
    await syncProjectBrainFiles(cwd);
    const config = await loadLocalConfig(cwd);
    const paths = neuronPaths(cwd);
    ui.success('MCP configured');
    ui.success('Rules / skills / commands refreshed');
    ui.success('Project brain files updated');
    ui.blank();
    ui.welcome([
      'Your project now has a memory layer.',
      `Project: ${config.project.name}`,
      `Cursor MCP: ${cursor.mcpPath}`,
      `Brain: ${paths.neuronDir}`,
    ]);
  }

  ui.blank();
  ui.suggest('Open this folder in Cursor → enable MCP server "neuron"');
  ui.suggest('Verify: neuron cursor doctor');
  ui.suggest('Try: Prepare adding a payment system using Neuron');
}
