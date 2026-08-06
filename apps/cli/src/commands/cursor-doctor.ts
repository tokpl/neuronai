import { diagnoseCursor } from '../services/cursor-setup.js';
import { ui } from '../ui/output.js';

export async function runCursorDoctor(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron cursor doctor');
  ui.blank();

  const report = await diagnoseCursor(cwd);
  let failed = 0;
  let reloadRequired = false;

  for (const check of report.checks) {
    if (check.ok) {
      ui.success(`${check.name}: ${check.detail}`);
    } else {
      failed += 1;
      if (check.reloadRequired) reloadRequired = true;
      ui.error(`${check.name}: ${check.detail}`);
      if (check.fix) ui.suggest(check.fix);
    }
  }

  ui.blank();
  if (failed === 0) {
    ui.success('Cursor integration looks healthy.');
    ui.suggest('In Cursor chat, call neuron_context before exploring the repo');
    return;
  }

  if (reloadRequired) {
    ui.failHelp(
      'MCP tool catalog is stale or incomplete.',
      [
        'Cursor is still running an old neuron MCP process',
        'Setup was upgraded but the host was not reloaded',
      ],
      [
        'Cursor Settings → Tools & MCP → toggle neuron OFF then ON',
        'Or: Developer: Reload Window',
        'Then: neuron cursor doctor',
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
