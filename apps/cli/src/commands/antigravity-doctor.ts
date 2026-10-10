import { diagnoseAntigravity } from '../services/cursor-setup.js';
import { formatNeuronMcpStatus } from '@neuronai/cursor-integration';
import { ui } from '../ui/output.js';

export async function runAntigravityDoctor(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron antigravity doctor');
  ui.blank();

  const report = await diagnoseAntigravity(cwd);

  console.log(formatNeuronMcpStatus(report.mcpStatus));
  ui.blank();
  if (report.mcpStatus.configured === 'PASS') {
    ui.info(`  ${report.mcpStatus.configuredDetail}`);
  }
  if (report.mcpStatus.freshStdio === 'PASS') {
    ui.info(`  ${report.mcpStatus.freshStdioDetail}`);
  }
  ui.info(`  IDE: ${report.mcpStatus.ideCatalogDetail}`);
  ui.warn(`  → ${report.mcpStatus.actionDetail}`);
  ui.blank();

  let failed = 0;

  for (const check of report.checks) {
    if (check.ok) {
      ui.success(`${check.name}: ${check.detail}`);
    } else {
      failed += 1;
      ui.error(`${check.name}: ${check.detail}`);
      if (check.fix) ui.suggest(check.fix);
    }
  }

  ui.blank();
  if (failed === 0) {
    ui.success('Configured workspace MCP + Antigravity guidance look healthy.');
    ui.warn('IDE catalog remains a MANUAL GATE until you Refresh MCP and Allow mcp(neuron/*).');
    ui.blank();
    console.log('Manual verification:');
    ui.info('  1. Antigravity → Customizations → Installed MCP Servers → Refresh');
    ui.info('  2. Allow mcp(neuron/*) if tools stay in Ask mode');
    ui.info('  3. In chat: agent should call neuron_context first');
    ui.info('  4. Confirm 🌱 contribution.summary footer after neuron_context');
    return;
  }

  ui.failHelp(
    'Neuron Antigravity wiring has issues.',
    [
      'Workspace MCP missing/invalid (.agents/mcp_config.json)',
      'Rule missing trigger: always_on (silently discarded by Antigravity)',
      'AGENTS.md Neuron block missing',
      'Project brain files missing (run init)',
    ],
    ['neuron antigravity setup --force', 'neuron antigravity doctor'],
  );
  process.exitCode = 1;
}
