/**
 * Final integration gate: clean project → Cursor setup → MCP handshake →
 * remember → stale path — against the packed/bundled production CLI.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const neuronBin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;

function run(args, cwd, input) {
  const r = spawnSync(node, [neuronBin, ...args], {
    cwd,
    encoding: 'utf8',
    input,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(`neuron ${args.join(' ')} failed (${r.status})`);
  }
  return r.stdout;
}

const root = mkdtempSync(join(tmpdir(), 'neuron-gate-'));
console.log(`project: ${root}`);

for (const dir of [
  'src/auth',
  'src/billing',
  'src/api/routes',
  'src/services',
  'src/repositories',
]) {
  mkdirSync(join(root, dir), { recursive: true });
}

writeFileSync(
  join(root, 'package.json'),
  JSON.stringify({
    name: 'acme-shop',
    dependencies: {
      express: '^4.19.0',
      stripe: '^17.0.0',
      pg: '^8.13.0',
      'drizzle-orm': '^0.36.0',
    },
  }),
  'utf8',
);

writeFileSync(
  join(root, 'README.md'),
  [
    '# Acme Shop',
    '',
    '- API handlers use a service layer',
    '- Controllers must not access the database directly',
    '- Never call payment providers from route handlers',
  ].join('\n'),
  'utf8',
);

const files = {
  'src/auth/middleware.ts':
    'export function authenticateRequest() {}\nexport function authMiddleware() {}\n',
  'src/auth/service.ts': 'export class AuthService {}\nexport function createUser() {}\n',
  'src/billing/stripe.ts': 'export class StripeClient {}\nexport function charge() {}\n',
  'src/billing/service.ts': 'export class BillingService {}\n',
  'src/api/routes/users.ts':
    "import { Router } from 'express';\nexport const router = Router();\nrouter.post('/api/users', () => {});\n",
  'src/api/routes/index.ts': 'export const routes = [];\n',
  'src/services/payment-service.ts': 'export class PaymentService {}\n',
  'src/repositories/user-repository.ts': 'export class UserRepository {}\n',
};
for (const [rel, body] of Object.entries(files)) {
  writeFileSync(join(root, rel), body, 'utf8');
}

run(['init', '--yes'], root);
run(['scan'], root);

console.log('\n== CLI context ==');
const queries = [
  'Where is authentication handled?',
  'Where is billing implemented?',
  'Where are API routes?',
];
for (const q of queries) {
  const out = run(['context', q], root);
  console.log(`\nQ: ${q}\n${out.trim()}`);
  if (!/src\//i.test(out)) throw new Error(`context missing path for: ${q}`);
}

console.log('\n== Cursor setup ==');
run(['cursor', 'setup', '--force'], root);
const mcp = JSON.parse(readFileSync(join(root, '.cursor', 'mcp.json'), 'utf8'));
console.log(JSON.stringify(mcp, null, 2));
const entry = mcp.mcpServers.neuron;
if (!entry?.args?.includes('mcp')) throw new Error('mcp.json missing mcp arg');
if (!/neuron_context/.test(readFileSync(join(root, '.cursor', 'rules', 'neuron-memory.mdc'), 'utf8'))) {
  throw new Error('rules still missing neuron_context');
}
if (/neuron_prepare_task|neuron_get_context/.test(
  readFileSync(join(root, '.cursor', 'rules', 'neuron-memory.mdc'), 'utf8'),
)) {
  throw new Error('rules still name legacy tools');
}

const doctor = run(['cursor', 'doctor'], root);
console.log(doctor);
if (!/healthy/i.test(doctor)) throw new Error('cursor doctor not healthy');

console.log('\n== MCP handshake ==');
const probe = spawnSync(node, [join(repo, 'scripts', 'mcp-handshake-probe.mjs'), root], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env },
});
console.log(probe.stdout);
if (probe.status !== 0) {
  console.error(probe.stderr);
  throw new Error('MCP handshake failed');
}
const handshake = JSON.parse(probe.stdout);
if (!handshake.expectedMatch) throw new Error('tools/list mismatch');
if (handshake.legacyTools.length) throw new Error(`legacy tools: ${handshake.legacyTools}`);

const metrics = [];
for (const q of [
  'Where is billing implemented?',
  'Where is authentication handled?',
  'Add a new billing endpoint. Where should this code live and what conventions should I follow?',
]) {
  const started = Date.now();
  // Use runtime via a tiny inline call through neuron context metrics in CLI text,
  // and also capture MCP metrics for the main UX query when matching.
  const out = run(['context', q], root);
  const latency = Date.now() - started;
  const m = /Context:\s*\n?\s*(\d+)(?:\s*\/\s*\d+)?\s*tokens/.exec(out);
  const corpus = /Project corpus:\s*\n?\s*(\d+)\s*tokens/.exec(out);
  const saved = /Estimated project context avoided:\s*\n?\s*~([^\n]+)/.exec(out);
  const ret = /Retrieval:\s*\n?\s*(\d+)\s*ms/.exec(out);
  metrics.push({
    query: q,
    contextTokens: m ? Number(m[1]) : null,
    corpusTokens: corpus ? Number(corpus[1]) : null,
    estimatedAvoided: saved?.[1]?.trim() ?? null,
    retrievalLatencyMs: ret ? Number(ret[1]) : latency,
    baseline: 'whole-brain-verbatim',
  });
}

console.log('\n== remember → MCP ==');
run(
  ['remember', 'Never call the payment provider directly from route handlers.', '--yes', '--type', 'business_rule'],
  root,
);

const { createRequire } = await import('node:module');
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const transport = new StdioClientTransport({
  command: entry.command,
  args: entry.args,
  env: { ...process.env, ...entry.env },
  stderr: 'pipe',
});
const client = new Client({ name: 'gate', version: '0' });
await client.connect(transport);
const rememberResult = await client.callTool({
  name: 'neuron_context',
  arguments: { task: 'What rule applies when adding a payment endpoint?' },
});
const rememberText = rememberResult.content.map((c) => c.text ?? '').join('');
const rememberBody = JSON.parse(rememberText);
console.log(JSON.stringify(rememberBody, null, 2));
if (!/payment|route/i.test(JSON.stringify(rememberBody))) {
  throw new Error('remembered rule did not surface via MCP');
}

console.log('\n== UX billing endpoint query ==');
const ux = await client.callTool({
  name: 'neuron_context',
  arguments: {
    task: 'Add a new billing endpoint. Where should this code live and what conventions should I follow?',
  },
});
const uxBody = JSON.parse(ux.content.map((c) => c.text ?? '').join(''));
console.log(JSON.stringify(uxBody, null, 2));
metrics.push({
  query: 'MCP: Add a new billing endpoint…',
  contextTokens: uxBody.metrics?.contextTokens ?? null,
  budgetTokens: uxBody.metrics?.budgetTokens ?? null,
  itemsSelected: uxBody.metrics?.itemsSelected ?? null,
  estimatedTokensSaved: uxBody.metrics?.estimatedTokensSaved ?? null,
  retrievalLatencyMs: uxBody.metrics?.retrievalMs ?? null,
  baseline: uxBody.metrics?.baseline ?? null,
});
await client.close();

console.log('\n== stale path ==');
rmSync(join(root, 'src', 'billing'), { recursive: true, force: true });
run(['scan', '--update'], root);
const afterDelete = run(['context', 'Where is billing implemented?'], root);
console.log(afterDelete);
// Map must not confidently present src/billing/ as authoritative after delete.
// Memory text may still mention billing historically; path pointers in map should be gone.
const map = JSON.parse(readFileSync(join(root, '.neuron', 'brain', 'knowledge.json'), 'utf8'));
const billingPaths = (map.map?.entries ?? []).filter((e) => /src\/billing/.test(e.path));
if (billingPaths.length) {
  throw new Error(`stale map paths remain: ${billingPaths.map((e) => e.path).join(', ')}`);
}
console.log('ok  map no longer contains src/billing paths');

writeFileSync(join(root, 'gate-metrics.json'), `${JSON.stringify({ metrics, handshake, uxBody }, null, 2)}\n`);
console.log('\n== metrics ==');
console.log(JSON.stringify(metrics, null, 2));
console.log(`\nGATE_OK project=${root}`);
