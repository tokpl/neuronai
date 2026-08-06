import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Proves the published CLI works for someone outside this monorepo.
 *
 * The failure this guards against: `workspace:*` deps become pinned exact
 * versions on publish, so the tarball silently pulls @neuronai/* packages from
 * the registry — including ones that no longer exist or are stale.
 */
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';

// `.cmd` shims need a shell on Windows; node binaries never do.
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows && cmd.endsWith('.cmd'),
  });

const work = mkdtempSync(join(tmpdir(), 'neuron-pkg-'));
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`);
  if (!ok) failures.push(label);
};

try {
  run(pnpm, ['pack', '--pack-destination', work], 'apps/cli');
  const tarball = join(
    work,
    readdirSync(work).find((f) => f.endsWith('.tgz')),
  );

  // 1. The manifest must not depend on any workspace package.
  run('tar', ['-xzf', tarball, '-C', work]);
  const manifest = JSON.parse(readFileSync(join(work, 'package', 'package.json'), 'utf8'));
  const neuronDeps = Object.keys(manifest.dependencies ?? {}).filter((d) =>
    d.startsWith('@neuronai/'),
  );
  check(
    neuronDeps.length === 0,
    `no @neuronai/* runtime deps (found: ${neuronDeps.join(', ') || 'none'})`,
  );
  check(Boolean(manifest.bin?.neuron), 'declares the `neuron` binary');

  // 2. It must install into a clean project with nothing else around.
  const project = join(work, 'consumer');
  mkdirSync(project, { recursive: true });
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ name: 'consumer', version: '1.0.0', dependencies: { express: '^4.21.0' } }),
  );
  writeFileSync(join(project, 'README.md'), '# Consumer\n\n- Uses Express for the HTTP layer.\n');
  mkdirSync(join(project, 'src', 'auth'), { recursive: true });
  writeFileSync(join(project, 'src', 'auth', 'login.ts'), 'export function login() {}');

  run(npm, ['install', '--no-audit', '--no-fund', tarball], project);

  const installed = readdirSync(join(project, 'node_modules'));
  check(!installed.includes('@neuronai'), 'installs zero @neuronai/* packages from the registry');

  // 3. It must actually run.
  const bin = join(project, 'node_modules', 'neuronai', 'dist', 'index.js');
  const version = run(process.execPath, [bin, '--version'], project).trim();
  check(version.length > 0, `runs: ${version}`);

  run(process.execPath, [bin, 'init', '--yes'], project);
  const search = run(process.execPath, [bin, 'search', 'authentication'], project);
  check(/auth/i.test(search), 'init + search return project knowledge');

  const context = run(process.execPath, [bin, 'context', 'Where is authentication handled?'], project);
  check(
    /auth|src\//i.test(context) &&
      /Context:\s*\n?\s*\d+(\s*\/\s*\d+)?\s*tokens/i.test(context) &&
      /Retrieval:\s*\n?\s*\d+\s*ms/i.test(context),
    'context returns project locations under a token budget',
  );

  const doctor = run(process.execPath, [bin, 'doctor'], project);
  check(/All checks passed/.test(doctor), 'doctor reports a healthy install');
  check(/Project map/i.test(doctor), 'doctor probes the project map');
  check(/Context budget/i.test(doctor), 'doctor probes context budget');

  // Packed CLI must embed the current Brain ranking implementation.
  const packedIndex = readFileSync(join(work, 'package', 'dist', 'index.js'), 'utf8');
  check(
    /locationRoleBoost|termsForConcept|dedupeRetrievalHits/.test(packedIndex),
    'packed CLI contains current Brain retrieval symbols',
  );
  const fp = JSON.parse(
    readFileSync(join(work, 'package', 'dist', 'brain-fingerprint.json'), 'utf8'),
  );
  const workspaceRank = readFileSync(
    join(repoRoot, 'packages', 'brain', 'src', 'retrieval', 'rank.ts'),
    'utf8',
  );
  const workspaceBrain = JSON.parse(
    readFileSync(join(repoRoot, 'packages', 'brain', 'package.json'), 'utf8'),
  );
  const expectedSha = createHash('sha1')
    .update(`${workspaceBrain.version}\n${workspaceRank}`)
    .digest('hex')
    .slice(0, 12);
  check(
    fp.rankSha === expectedSha && fp.brainVersion === workspaceBrain.version,
    `packed Brain fingerprint matches workspace (${fp.brainVersion}@${fp.rankSha})`,
  );
  check(
    packedIndex.includes(fp.rankSha),
    'packed index.js embeds the Brain fingerprint hash',
  );

  // Remember → retrieve round-trip on the packed binary.
  run(process.execPath, [
    bin,
    'remember',
    'Never call payment providers from route handlers.',
    '--yes',
    '--type',
    'business_rule',
  ], project);
  const remembered = run(
    process.execPath,
    [bin, 'context', 'What rule applies to payment code?'],
    project,
  );
  check(
    /Never call payment providers|payment/i.test(remembered),
    'remember → context retrieves stored rule',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} package check(s) failed`);
  process.exit(1);
}
console.log('\npackage verified: standalone install works');
