/**
 * Ensure workspace packages that the CLI bundles are built before esbuild runs.
 * Prevents shipping a neuronai tarball with a stale Brain/scanner.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(cliRoot, '..', '..');
const isWindows = process.platform === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';

/** Paths relative to repo root that the CLI bundle resolves. */
const REQUIRED = [
  { dir: 'packages/types', filter: '@neuronai/types' },
  { dir: 'packages/brain', filter: '@neuronai/brain' },
  { dir: 'packages/project-scanner', filter: '@neuronai/project-scanner' },
  { dir: 'packages/storage', filter: '@neuronai/storage' },
  { dir: 'packages/memory-engine', filter: '@neuronai/memory-engine' },
  { dir: 'packages/config', filter: '@neuronai/config' },
  { dir: 'packages/project-analyzer', filter: '@neuronai/project-analyzer' },
  { dir: 'packages/agent-workflow', filter: '@neuronai/agent-workflow' },
  { dir: 'packages/cursor-integration', filter: '@neuronai/cursor-integration' },
  { dir: 'apps/mcp-server', filter: '@neuronai/mcp-server' },
];

function newestMtime(dir, fallback = 0) {
  if (!existsSync(dir)) return fallback;
  let newest = fallback;
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) {
        if (name.name === 'node_modules' || name.name === 'dist') continue;
        walk(p);
      } else if (/\.(ts|tsx|js|mjs|cjs|json)$/.test(name.name)) {
        newest = Math.max(newest, statSync(p).mtimeMs);
      }
    }
  };
  walk(dir);
  return newest;
}

function distReady(pkgDir) {
  const dist = join(repoRoot, pkgDir, 'dist');
  if (!existsSync(dist)) return false;
  const srcNewest = newestMtime(join(repoRoot, pkgDir, 'src'));
  const distNewest = newestMtime(dist);
  return distNewest >= srcNewest - 1000;
}

const stale = REQUIRED.filter((pkg) => !distReady(pkg.dir));
if (stale.length === 0) {
  console.log('workspace packages up to date for CLI bundle');
  process.exit(0);
}

console.log(`building workspace deps before CLI bundle: ${stale.map((s) => s.filter).join(', ')}`);
execFileSync(
  pnpm,
  ['exec', 'turbo', 'run', 'build', ...stale.flatMap((p) => ['--filter', p.filter])],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: isWindows,
  },
);
