import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Set the release version.
 *
 * Only `neuronai` is published — the workspace libraries are private and get
 * bundled into it — so this touches the CLI manifest, the root manifest and the
 * version constants that the CLI and MCP server report at runtime.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootPkgPath = join(root, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));

const version = process.argv[2] ?? rootPkg.version;
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version "${version}". Usage: pnpm prepare:npm <version>   e.g. 0.2.0`);
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

const cliPkgPath = join(root, 'apps', 'cli', 'package.json');
const cliPkg = JSON.parse(readFileSync(cliPkgPath, 'utf8'));
cliPkg.version = version;
cliPkg.license = 'AGPL-3.0';
writeFileSync(cliPkgPath, `${JSON.stringify(cliPkg, null, 2)}\n`);
console.log(`updated  ${cliPkg.name} ${version}`);

copyFileSync(join(root, 'LICENSE'), join(root, 'apps', 'cli', 'LICENSE'));

rootPkg.version = version;
writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
console.log(`updated  ${rootPkg.name} ${version}`);

patchConstant(join(root, 'apps/cli/src/services/neuron-fs.ts'), 'CLI_VERSION');
patchConstant(join(root, 'apps/mcp-server/src/health.ts'), 'VERSION');

console.log('\nNext: pnpm release');
