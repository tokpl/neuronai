import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Local-first, verified rather than asserted.
 *
 * Runs the full journey with outbound sockets and DNS disabled. Any network
 * attempt throws, so a regression that adds a fetch or a telemetry ping fails here.
 */
const GUARD = `
const net = require('node:net');
const dns = require('node:dns');
const fail = (what) => { throw new Error('NETWORK ACCESS ATTEMPTED: ' + what); };
net.Socket.prototype.connect = () => fail('net.connect');
net.connect = () => fail('net.connect');
net.createConnection = () => fail('net.createConnection');
dns.lookup = () => fail('dns.lookup');
dns.promises.lookup = () => fail('dns.lookup');
globalThis.fetch = () => fail('fetch');
`;

const work = mkdtempSync(join(tmpdir(), 'neuron-offline-'));
const guardFile = join(work, 'no-network.cjs');
writeFileSync(guardFile, GUARD);

const project = join(work, 'project');
mkdirSync(join(project, 'src', 'auth'), { recursive: true });
writeFileSync(
  join(project, 'package.json'),
  JSON.stringify({ name: 'offline-app', version: '1.0.0', dependencies: { next: '^15.0.0' } }),
);
writeFileSync(
  join(project, 'README.md'),
  '# Offline App\n\n- Authentication uses JWT middleware.\n- PostgreSQL is the system of record.\n',
);
writeFileSync(join(project, 'src', 'auth', 'jwt.ts'), 'export function signToken() {}');

const cli = join(process.cwd(), 'apps', 'cli', 'dist', 'index.js');
const failures = [];

const attempt = (label, args) => {
  try {
    const out = execFileSync(process.execPath, ['--require', guardFile, cli, ...args], {
      cwd: project,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(`ok    ${label}`);
    return out;
  } catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    console.log(`FAIL  ${label}`);
    if (detail.includes('NETWORK ACCESS ATTEMPTED')) {
      console.error('      network access attempted with no network available');
    }
    console.error(detail.split('\n').slice(0, 12).join('\n'));
    failures.push(label);
    return '';
  }
};

try {
  attempt('init  (no network)', ['init', '--yes']);
  attempt('scan  (no network)', ['scan']);
  const search = attempt('search (no network)', ['search', 'authentication']);
  if (search && !/auth/i.test(search)) {
    console.log('FAIL  search returned no project knowledge offline');
    failures.push('search relevance offline');
  }
  attempt('doctor (no network)', ['doctor']);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} offline check(s) failed`);
  process.exit(1);
}
console.log('\noffline verified: the full journey runs with no network');
