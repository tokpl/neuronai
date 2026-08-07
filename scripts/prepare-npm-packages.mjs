import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Set the release version.
 *
 * Only `neuronai` is published — the workspace libraries are private and get
 * bundled into it — so this touches every package.json plus MCP VERSION.
 * CLI runtime version is generated from apps/cli/package.json during `pnpm build`
 * (see scripts/bundle.mjs) — no separate CLI_VERSION constant to patch.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootPkgPath = join(root, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));

const version = process.argv[2] ?? rootPkg.version;
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version "${version}". Usage: pnpm prepare:npm <version>   e.g. 0.2.2`);
  process.exit(1);
}

function patchConstant(filePath, exportName) {
  if (!existsSync(filePath)) return;
  const src = readFileSync(filePath, 'utf8');
  const next = src.replace(
    new RegExp(`(export const ${exportName}\\s*=\\s*['"])[^'"]+(['"])`),
    `$1${version}$2`,
  );
  if (next !== src) {
    writeFileSync(filePath, next);
    console.log(`patched  ${exportName} -> ${version}`);
  }
}

function patchPackageJson(filePath) {
  if (!existsSync(filePath)) return;
  const pkg = JSON.parse(readFileSync(filePath, 'utf8'));
  pkg.version = version;
  writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`updated  ${pkg.name ?? filePath} ${version}`);
}

const packageJsons = [
  join(root, 'package.json'),
  join(root, 'apps', 'cli', 'package.json'),
  join(root, 'apps', 'mcp-server', 'package.json'),
  join(root, 'packages', 'agent-workflow', 'package.json'),
  join(root, 'packages', 'brain', 'package.json'),
  join(root, 'packages', 'config', 'package.json'),
  join(root, 'packages', 'cursor-integration', 'package.json'),
  join(root, 'packages', 'memory-engine', 'package.json'),
  join(root, 'packages', 'project-analyzer', 'package.json'),
  join(root, 'packages', 'project-scanner', 'package.json'),
  join(root, 'packages', 'storage', 'package.json'),
  join(root, 'packages', 'types', 'package.json'),
];

for (const file of packageJsons) patchPackageJson(file);

copyFileSync(join(root, 'LICENSE'), join(root, 'apps', 'cli', 'LICENSE'));

patchConstant(join(root, 'apps/mcp-server/src/health.ts'), 'VERSION');

console.log('\nNext: pnpm build && pnpm release');
console.log('Note: CLI -v comes from apps/cli/package.json via bundle.mjs');
