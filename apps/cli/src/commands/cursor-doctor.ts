import { diagnoseCursor } from '../services/cursor-setup.js';
import { formatNeuronMcpStatus } from '@neuronai/cursor-integration';
import { ui } from '../ui/output.js';

export async function runCursorDoctor(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron cursor doctor');
  ui.blank();

  const report = await diagnoseCursor(cwd);

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
    ui.success('Configured MCP + fresh stdio look healthy.');
    ui.warn('CURSOR_MCP remains a MANUAL GATE until you reload and verify the IDE catalog.');
    ui.blank();
    console.log('Manual verification (required for CURSOR_MCP = PASS):');
    ui.info('  1. Cursor Settings → Tools & MCP → toggle neuron OFF');
    ui.info('  2. Toggle neuron ON  (or Developer: Reload Window)');
    ui.info('  3. Open Tools & MCP → neuron');
    ui.info('  4. Confirm exactly 7 tools (no neuron_prepare_task / neuron_get_context)');
    ui.info('  5. Confirm neuron_context is listed');
    ui.info('  6. In chat: call neuron_context for a real task');
    ui.info('  7. Confirm a real project path + remembered rules (no -32602)');
    return;
  }

  if (report.mcpStatus.action === 'FIX_BINARY' || report.mcpStatus.action === 'FIX_CONFIG') {
    ui.failHelp(
      'Neuron MCP wiring/binary has issues (stdio probe).',
      [
        'MCP config missing or invalid (.cursor/mcp.json)',
        'Configured binary does not expose the 7-tool surface',
        'neuron_context missing or not callable on fresh stdio',
      ],
      [
        'pnpm build (monorepo) or reinstall neuronai',
        'neuron cursor setup --force',
        'neuron cursor doctor',
      ],
    );
  } else {
    ui.failHelp(
      'Neuron MCP / Cursor wiring has issues.',
      [
        'MCP config missing or invalid (.cursor/mcp.json)',
        '`neuron` binary not reachable for the Cursor host process',
        'Project brain files missing (run init)',
      ],
      ['neuron cursor setup --force', 'neuron cursor doctor'],
    );
  }
  process.exitCode = 1;
}
