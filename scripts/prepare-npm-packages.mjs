import { copyFileSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2] ?? '0.1.2';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const licenseSrc = join(root, 'LICENSE');

const roots = [join(root, 'packages'), join(root, 'apps')];

const dirs = roots.flatMap((r) =>
  readdirSync(r, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(r, d.name)),
);

function ensureLicenseInFiles(files) {
  const list = Array.isArray(files) ? [...files] : ['dist'];
  if (!list.includes('LICENSE')) list.push('LICENSE');
  return list;
}

function patchVersionConstant(filePath, exportName, nextVersion) {
  if (!existsSync(filePath)) return;
  const src = readFileSync(filePath, 'utf8');
  const next = src.replace(
    new RegExp(`(export const ${exportName}\\s*=\\s*['"])[^'"]+(['"])`),
    `$1${nextVersion}$2`,
  );
  if (next !== src) {
    writeFileSync(filePath, next);
    console.log('patched', filePath.replace(root + '\\', '').replace(root + '/', ''), nextVersion);
  }
}

for (const dir of dirs) {
  const p = join(dir, 'package.json');
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  if (j.private === true) continue;

  j.version = version;
  j.publishConfig = { ...(j.publishConfig ?? {}), access: 'public' };
  j.repository = j.repository ?? {
    type: 'git',
    url: 'https://github.com/tokpl/neuronai.git',
  };
  j.homepage = j.homepage ?? 'https://github.com/tokpl/neuronai';
  j.bugs = j.bugs ?? { url: 'https://github.com/tokpl/neuronai/issues' };
  j.engines = j.engines ?? { node: '>=22' };
  j.license = 'AGPL-3.0';
  j.files = ensureLicenseInFiles(j.files);

  if (j.name === 'neuronai') {
    j.description =
      'NeuronAI - CLI for Neuron - AI Memory (local-first Cursor project memory)';
  } else if (typeof j.name === 'string' && j.name.startsWith('@neuronai/')) {
    const short = j.name.slice('@neuronai/'.length);
    j.description = `NeuronAI / ${short} - package for Neuron - AI Memory`;
  }

  writeFileSync(p, JSON.stringify(j, null, 2) + '\n');

  if (existsSync(licenseSrc)) {
    copyFileSync(licenseSrc, join(dir, 'LICENSE'));
  }

  console.log('updated', j.name, version);
}

const rootPkgPath = join(root, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
rootPkg.version = version;
rootPkg.license = 'AGPL-3.0';
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
console.log('updated', rootPkg.name, version);

patchVersionConstant(join(root, 'apps/cli/src/services/neuron-fs.ts'), 'CLI_VERSION', version);
patchVersionConstant(
  join(root, 'packages/observability/src/index.ts'),
  'PACKAGE_VERSION',
  version,
);
