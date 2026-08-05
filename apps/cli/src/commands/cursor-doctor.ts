import { diagnoseCursor } from '../services/cursor-setup.js';
import { ui } from '../ui/output.js';

export async function runCursorDoctor(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron cursor doctor');
  ui.blank();

  const report = await diagnoseCursor(cwd);
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
    ui.success('Cursor integration looks healthy.');
    ui.suggest('In Cursor chat: call neuron_health, then neuron_prepare_task');
    return;
  }

  ui.failHelp(
    'Neuron MCP / Cursor wiring has issues.',
    [
      'Cursor is closed or MCP servers were not reloaded',
      'MCP config missing or invalid (.cursor/mcp.json)',
      '`neuron` binary not on PATH for the Cursor host process',
      'Project brain files missing (run init cursor)',
    ],
    ['neuron cursor setup --force', 'neuron cursor doctor', 'Reload Cursor window after fixing MCP'],
  );
  process.exitCode = 1;
}
