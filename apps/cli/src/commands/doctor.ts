import { runDoctorChecks } from '../diagnostics/doctor-checks.js';
import { ui } from '../ui/output.js';

export async function runDoctor(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron doctor');
  ui.blank();
  ui.info('Diagnosing Node, storage, permissions, Cursor, and MCP…');
  ui.blank();

  const checks = await runDoctorChecks(cwd);
  let failed = 0;

  for (const check of checks) {
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
    ui.success('All checks passed.');
  } else {
    ui.warn(`${failed} issue(s) found.`);
    process.exitCode = 1;
  }
}
