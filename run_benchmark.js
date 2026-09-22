import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { runDoctorChecks } from './apps/cli/src/diagnostics/doctor-checks.ts';

async function main() {
  const cwd = resolve('benchmark-fake-project');
  const times = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    await runDoctorChecks(cwd);
    const end = performance.now();
    times.push(end - start);
  }
  console.log(`Average: ${times.reduce((a, b) => a + b) / times.length}ms (runs: ${times.map(t => t.toFixed(2)).join(', ')})`);
}
main().catch(console.error);
