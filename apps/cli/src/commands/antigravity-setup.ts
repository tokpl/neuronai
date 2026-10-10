import { ProgressUI } from '../progress/progress-ui.js';
import { setupAntigravityIntegration } from '../services/cursor-setup.js';
import { ui } from '../ui/output.js';

/**
 * Wire Antigravity: rules, skill, AGENTS.md, workspace + global MCP.
 */
export async function runAntigravitySetup(
  cwd = process.cwd(),
  options: { force?: boolean } = {},
): Promise<void> {
  ui.title('Neuron antigravity setup');
  ui.blank();
  ui.info('Local-first Antigravity integration - no cloud account.');
  ui.blank();

  const progress = new ProgressUI(3);
  progress.start('Writing Antigravity rules + skill…');
  const result = await setupAntigravityIntegration(cwd, options);
  progress.ok(`Rules → ${result.rulesPath}`);

  progress.start('Updating MCP configuration…');
  if (result.mcpConfigured) {
    progress.ok(`Workspace MCP → ${result.workspaceMcpPath}`);
  } else {
    progress.fail(`MCP validation failed: ${result.mcpErrors.join('; ')}`);
    process.exitCode = 1;
  }

  progress.start('AGENTS.md Neuron block…');
  progress.ok(`AGENTS.md → ${result.agentsMdPath}`);
  progress.done();

  ui.kv('Skill', result.skillPath);
  ui.kv('Global MCP', result.globalMcpPath);
  for (const w of result.mcpWarnings) {
    ui.warn(w);
  }
  ui.blank();
  ui.info('Enable MCP in Antigravity (required):');
  ui.suggest('1. Agent panel … → MCP Servers → Refresh');
  ui.suggest('2. Allow mcp(neuron/*) in permission settings (tools default to Ask)');
  ui.suggest('3. Confirm neuron_context is available to the agent');
  ui.blank();
  ui.suggest('Then run: neuron antigravity doctor');
}
