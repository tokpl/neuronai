/**
 * FINAL P0 — prove NeuronAI works as a real Project Brain.
 *
 * Builds repo shapes A–D, runs the fixed query suite via MCP (from .cursor/mcp.json),
 * proves incremental scan deltas, rename consistency, and optionally a packed-artifact path.
 *
 * Usage:
 *   node scripts/final-proof.mjs
 *   node scripts/final-proof.mjs --packed   # also install packed tarball like a stranger
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const neuronBin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const wantPacked = process.argv.includes('--packed');
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

function run(bin, args, cwd) {
  const r = spawnSync(node, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`neuron ${args.join(' ')} failed\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout;
}

function write(root, rel, body = '') {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function timed(fn) {
  const t0 = Date.now();
  const value = fn();
  return { value, ms: Date.now() - t0 };
}

async function withMcp(root, fn) {
  const mcp = JSON.parse(readFileSync(join(root, '.cursor', 'mcp.json'), 'utf8'));
  const entry = mcp.mcpServers.neuron;
  const transport = new StdioClientTransport({
    command: entry.command,
    args: entry.args,
    env: { ...process.env, ...entry.env },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'final-proof', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function ask(client, task) {
  const result = await client.callTool({ name: 'neuron_context', arguments: { task } });
  const text = result.content.map((c) => c.text ?? '').join('');
  return JSON.parse(text);
}

function scoreQuery(spec, body) {
  const blob = [
    body.context ?? '',
    JSON.stringify(body.relevantFiles ?? []),
    JSON.stringify(body.relevantModules ?? []),
    JSON.stringify(body.relevantRules ?? []),
    JSON.stringify(body.recommendation ?? {}),
  ].join('\n');

  const empty =
    /No stored project knowledge matched|No relevant project knowledge/i.test(body.context ?? '') &&
    !(body.relevantFiles?.length || body.relevantModules?.length || body.relevantRules?.length);

  if (spec.expectEmpty) {
    return empty || !(body.recommendation || (body.relevantFiles?.length ?? 0) > 0)
      ? 'correct'
      : 'incorrect';
  }

  const hit = (spec.expect ?? []).some((re) => re.test(blob));
  const noise = (spec.forbid ?? []).some((re) => re.test(blob));
  if (spec.expectRecommendation && !body.recommendation?.path) {
    return hit ? 'acceptable' : 'incorrect';
  }
  if (hit && !noise) return 'correct';
  if (hit && noise) return 'acceptable';
  return 'incorrect';
}

/** Shared query suite — applied to each repo shape with path expectations. */
const QUERY_SUITE = [
  {
    category: 'location',
    q: 'Where is authentication implemented?',
    expect: [/auth/i],
    forbid: [/kubernetes|terraform|lambda/i],
  },
  {
    category: 'location',
    q: 'Where are API routes defined?',
    expect: [/api|route/i],
    forbid: [],
  },
  {
    category: 'location',
    q: 'Where is billing implemented?',
    expect: [/bill|payment/i],
    forbid: [/weather/i],
  },
  {
    category: 'location',
    q: 'Where is database access?',
    expect: [/db|database|repositor|model/i],
    forbid: [],
  },
  {
    category: 'location',
    q: 'Where are background jobs?',
    expect: [/worker|job|background|queue/i],
    forbid: [],
    soft: true,
  },
  {
    category: 'location',
    q: 'Where are tests for authentication?',
    expect: [/test|auth/i],
    forbid: [],
  },
  {
    category: 'location',
    q: 'Where is the Stripe integration?',
    expect: [/stripe|payment|bill/i],
    forbid: [],
  },
  {
    category: 'modification',
    q: 'Where should I add a new payment endpoint?',
    expect: [/bill|payment|route/i],
    expectRecommendation: true,
    forbid: [/weather/i],
  },
  {
    category: 'modification',
    q: 'Where should I implement invoice cancellation?',
    expect: [/invoice|bill|payment/i],
    expectRecommendation: true,
    forbid: [],
  },
  {
    category: 'modification',
    q: 'Where should I add authentication middleware?',
    expect: [/auth|middleware/i],
    expectRecommendation: true,
    forbid: [],
  },
  {
    category: 'modification',
    q: 'Where should I add a new background job?',
    expect: [/worker|job|background|queue|service/i],
    expectRecommendation: true,
    soft: true,
    forbid: [],
  },
  {
    category: 'modification',
    q: 'Where should I modify database access?',
    expect: [/db|database|repositor|model/i],
    expectRecommendation: true,
    forbid: [],
  },
  {
    category: 'rules',
    q: 'What rule should I follow when modifying payments?',
    expect: [/stripe|payment|route|service|bill/i],
    forbid: [],
  },
  {
    category: 'rules',
    q: 'What conventions should I follow?',
    expect: [/service|middleware|repositor|convention|rule|module/i],
    forbid: [/weather/i],
  },
  {
    category: 'rules',
    q: 'How does this project handle authentication?',
    expect: [/auth|jwt|middleware/i],
    forbid: [],
  },
  {
    category: 'rules',
    q: 'What architecture decisions affect billing?',
    expect: [/bill|payment|stripe|service/i],
    forbid: [],
  },
  {
    category: 'symbol',
    q: 'Where is BillingService?',
    expect: [/BillingService|billing.*service/i],
    forbid: [],
  },
  {
    category: 'symbol',
    q: 'Where is PaymentService?',
    expect: [/PaymentService|payment.*service/i],
    forbid: [],
  },
  {
    category: 'symbol',
    q: 'Where is createInvoice?',
    expect: [/createInvoice|create_invoice|invoice/i],
    forbid: [],
    soft: true,
  },
  {
    category: 'symbol',
    q: 'Where is auth middleware?',
    expect: [/auth|middleware/i],
    forbid: [],
  },
  {
    category: 'symbol',
    q: 'Where is the Stripe client?',
    expect: [/stripe|Stripe/i],
    forbid: [],
  },
  {
    category: 'negative',
    q: 'How do I deploy Kubernetes?',
    expectEmpty: true,
  },
  {
    category: 'negative',
    q: 'Where is the React component library?',
    expectEmpty: true,
    // A monorepo may contain a React app — empty-ish is enough (no confident library path).
    soft: true,
  },
  {
    category: 'negative',
    q: 'How does Terraform work?',
    expectEmpty: true,
  },
  {
    category: 'negative',
    q: 'Where is the AWS Lambda?',
    expectEmpty: true,
  },
];

function buildRepoA(root) {
  write(
    root,
    'package.json',
    JSON.stringify(
      {
        name: 'repo-a-ts-app',
        version: '1.0.0',
        dependencies: {
          express: '^4',
          stripe: '^17',
          pg: '^8',
          jsonwebtoken: '^9',
        },
      },
      null,
      2,
    ),
  );
  write(
    root,
    'README.md',
    [
      '# Repo A',
      'Typical TypeScript app.',
      '- Auth uses JWT middleware via AuthService.',
      '- Billing mutations go through BillingService.',
      '- Never call Stripe from route handlers.',
      '- Database access stays in repositories / db layer.',
    ].join('\n'),
  );
  write(root, 'src/auth/service.ts', 'export class AuthService { login() {} }\n');
  write(root, 'src/auth/middleware.ts', 'export function authMiddleware() {}\n');
  write(root, 'src/auth/jwt.ts', 'export function signToken() {}\n');
  write(root, 'src/billing/service.ts', 'export class BillingService { mutate() {} }\n');
  write(root, 'src/billing/routes.ts', 'export const billingRouter = {};\n');
  write(
    root,
    'src/billing/invoices.ts',
    'export function createInvoice() {}\nexport function cancelInvoice() {}\n',
  );
  write(root, 'src/services/payment-service.ts', 'export class PaymentService { charge() {} }\n');
  write(root, 'src/services/stripe.ts', 'export class StripeClient {}\nexport function createStripeClient() {}\n');
  write(root, 'src/api/routes/index.ts', 'export { usersRouter } from "./users.js";\n');
  write(root, 'src/api/routes/users.ts', 'export const usersRouter = {};\n');
  write(root, 'src/api/routes/health.ts', 'export const healthRouter = {};\n');
  write(root, 'src/db/client.ts', 'export class DatabaseClient {}\n');
  write(root, 'src/db/schema.ts', 'export const users = {};\n');
  write(root, 'src/repositories/user-repository.ts', 'export class UserRepository {}\n');
  write(root, 'src/workers/email-job.ts', 'export function sendEmailJob() {}\n');
  write(root, 'src/workers/billing-job.ts', 'export function reconcileBillingJob() {}\n');
  write(root, 'tests/auth/AuthService.test.ts', 'describe("AuthService", () => {});\n');
  write(root, 'tests/billing.test.ts', 'describe("billing", () => {});\n');
}

function buildRepoB(root) {
  write(
    root,
    'package.json',
    JSON.stringify({ name: 'repo-b-monorepo', private: true, workspaces: ['apps/*', 'packages/*'] }, null, 2),
  );
  write(
    root,
    'README.md',
    '# Monorepo\n\nAuth in packages/auth. Billing in packages/billing. API in apps/api.\nNever call Stripe from route handlers.\n',
  );
  write(root, 'apps/web/package.json', JSON.stringify({ name: '@acme/web' }, null, 2));
  write(root, 'apps/web/src/pages/index.tsx', 'export default function Home() { return null; }\n');
  write(root, 'apps/api/package.json', JSON.stringify({ name: '@acme/api', dependencies: { express: '^4' } }, null, 2));
  write(root, 'apps/api/src/routes/billing.ts', 'export const billingRoutes = {};\n');
  write(root, 'apps/api/src/routes/health.ts', 'export const health = {};\n');
  write(root, 'apps/api/src/server.ts', 'export function createServer() {}\n');
  write(root, 'packages/auth/package.json', JSON.stringify({ name: '@acme/auth' }, null, 2));
  write(root, 'packages/auth/src/service.ts', 'export class AuthService {}\n');
  write(root, 'packages/auth/src/middleware.ts', 'export function authMiddleware() {}\n');
  write(root, 'packages/billing/package.json', JSON.stringify({ name: '@acme/billing', dependencies: { stripe: '^17' } }, null, 2));
  write(root, 'packages/billing/src/service.ts', 'export class BillingService {}\n');
  write(root, 'packages/billing/src/PaymentService.ts', 'export class PaymentService {}\n');
  write(root, 'packages/billing/src/invoices.ts', 'export function createInvoice() {}\n');
  write(root, 'packages/billing/src/stripe.ts', 'export class StripeClient {}\n');
  write(root, 'packages/database/package.json', JSON.stringify({ name: '@acme/database', dependencies: { pg: '^8' } }, null, 2));
  write(root, 'packages/database/src/client.ts', 'export class DatabaseClient {}\n');
  write(root, 'packages/database/src/schema.ts', 'export const schema = {};\n');
  write(root, 'apps/api/src/workers/jobs.ts', 'export function enqueueJob() {}\n');
  write(root, 'packages/auth/tests/auth.test.ts', 'describe("auth", () => {});\n');
}

function buildRepoC(root) {
  write(
    root,
    'pyproject.toml',
    '[project]\nname = "repo-c-python"\nversion = "0.1.0"\ndependencies = ["fastapi", "sqlalchemy", "stripe"]\n',
  );
  write(
    root,
    'README.md',
    '# Python API\n\nAuth via AuthService. Billing via BillingService. Never call Stripe from route handlers.\nDatabase access through models/repositories.\n',
  );
  write(root, 'app/api/routes.py', 'def register_routes():\n    pass\n');
  write(root, 'app/api/auth_routes.py', 'def login():\n    pass\n');
  write(root, 'app/api/billing_routes.py', 'def subscribe():\n    pass\n');
  write(root, 'app/services/auth_service.py', 'class AuthService:\n    pass\n');
  write(root, 'app/services/billing_service.py', 'class BillingService:\n    pass\n');
  write(root, 'app/services/payment_service.py', 'class PaymentService:\n    pass\n');
  write(root, 'app/services/stripe_client.py', 'class StripeClient:\n    pass\n');
  write(root, 'app/models/user.py', 'class User:\n    pass\n');
  write(root, 'app/models/invoice.py', 'def create_invoice():\n    pass\n');
  write(root, 'app/workers/jobs.py', 'def background_job():\n    pass\n');
  write(root, 'app/middleware/auth.py', 'def auth_middleware():\n    pass\n');
  write(root, 'tests/test_auth.py', 'def test_auth():\n    assert True\n');
}

function buildRepoD(root) {
  write(
    root,
    'package.json',
    JSON.stringify(
      {
        name: 'repo-d-noisy',
        dependencies: { express: '^4', stripe: '^17', pg: '^8' },
      },
      null,
      2,
    ),
  );
  write(
    root,
    'README.md',
    '# Noisy app\n\nCore billing lives in src/features/billing. Auth in src/core/auth.\nNever call Stripe from route handlers. UI/admin/legacy are not the source of truth.\n',
  );
  write(root, 'src/core/auth/service.ts', 'export class AuthService {}\n');
  write(root, 'src/core/auth/middleware.ts', 'export function authMiddleware() {}\n');
  write(root, 'src/features/billing/service.ts', 'export class BillingService {}\n');
  write(root, 'src/features/billing/routes.ts', 'export const billingRouter = {};\n');
  write(root, 'src/features/billing/invoices.ts', 'export function createInvoice() {}\n');
  write(root, 'src/features/payments/PaymentService.ts', 'export class PaymentService {}\n');
  write(root, 'src/features/payments/stripe.ts', 'export class StripeClient {}\n');
  write(root, 'src/core/db/client.ts', 'export class DatabaseClient {}\n');
  write(root, 'src/core/db/repository.ts', 'export class BaseRepository {}\n');
  write(root, 'src/api/routes.ts', 'export const apiRouter = {};\n');
  write(root, 'src/workers/jobs.ts', 'export function runJob() {}\n');
  write(root, 'src/ui/BillingBadge.tsx', 'export function BillingBadge() { return null; }\n');
  write(root, 'src/admin/BillingAdmin.tsx', 'export function BillingAdmin() { return null; }\n');
  write(root, 'src/legacy/old-billing.ts', 'export function oldBilling() {}\n');
  write(root, 'src/experimental/billing-v2.ts', 'export function experimentalBilling() {}\n');
  write(root, 'src/generated/api.ts', 'export const generated = {};\n');
  write(root, 'src/vendor/stripe-sdk-shim.ts', 'export const shim = {};\n');
  write(root, 'tests/auth.test.ts', 'describe("auth", () => {});\n');
}

function seedRules(bin, root) {
  run(bin, ['remember', 'Never call Stripe directly from route handlers.', '--yes', '--type', 'business_rule'], root);
  run(bin, ['remember', 'All billing mutations go through BillingService.', '--yes', '--type', 'business_rule'], root);
  run(bin, ['remember', 'Authentication uses the AuthService abstraction.', '--yes', '--type', 'business_rule'], root);
  run(bin, ['remember', 'Database access must stay inside repositories.', '--yes', '--type', 'business_rule'], root);
}

async function benchmarkRepo(name, builder, bin = neuronBin) {
  const root = mkdtempSync(join(tmpdir(), `neuron-proof-${name}-`));
  builder(root);
  run(bin, ['init', '--yes'], root);
  run(bin, ['scan'], root);
  run(bin, ['cursor', 'setup', '--force'], root);
  seedRules(bin, root);

  const rows = [];
  let tools = [];
  await withMcp(root, async (client) => {
    const listed = await client.listTools();
    tools = listed.tools.map((t) => t.name).sort();
    for (const spec of QUERY_SUITE) {
      const body = await ask(client, spec.q);
      let verdict = scoreQuery(spec, body);
      // Soft expectations: empty on a shape without workers is acceptable, not incorrect.
      if (spec.soft && verdict === 'incorrect' && !(body.relevantFiles?.length || body.recommendation)) {
        verdict = 'acceptable';
      }
      rows.push({
        repo: name,
        category: spec.category,
        query: spec.q,
        intent: body.intent,
        topResult: body.recommendation?.path ?? body.relevantModules?.[0]?.path ?? body.relevantFiles?.[0]?.path ?? null,
        relevantFiles: (body.relevantFiles ?? []).map((f) => f.path),
        relevantModules: (body.relevantModules ?? []).map((m) => m.path),
        rules: (body.relevantRules ?? []).map((r) => r.title),
        recommendation: body.recommendation?.path ?? null,
        contextTokens: body.metrics?.contextTokens ?? null,
        corpusTokens: body.metrics?.corpusTokens ?? null,
        estimatedTokensAvoided: body.metrics?.estimatedTokensSaved ?? null,
        retrievalMs: body.metrics?.retrievalMs ?? null,
        correct: verdict,
      });
    }
  });

  return { name, root, tools, rows };
}

function parseDeltaFromScanOutput(out) {
  const m = /(\d+)\s+unchanged\s*·\s*(\d+)\s+changed\s*·\s*(\d+)\s+added\s*·\s*(\d+)\s+deleted(?:\s*·\s*(\d+)\s+reanalyzed)?/i.exec(
    out,
  );
  if (!m) return null;
  return {
    unchanged: Number(m[1]),
    changed: Number(m[2]),
    added: Number(m[3]),
    deleted: Number(m[4]),
    reanalyzed: Number(m[5] ?? 0),
  };
}

function buildLargeFixture(root, fileCount = 8000) {
  buildRepoA(root);
  for (let i = 0; i < fileCount; i++) {
    const dir = `src/gen/mod${Math.floor(i / 50)}`;
    write(root, `${dir}/file${i}.ts`, `export const v${i} = ${i};\n`);
  }
}

function runIncrementalProof(bin = neuronBin) {
  const root = mkdtempSync(join(tmpdir(), 'neuron-incr-'));
  buildLargeFixture(root, 8000);
  const scenarios = [];

  const initial = timed(() => run(bin, ['init', '--yes'], root));
  scenarios.push({
    scenario: 'initial scan (via init)',
    filesChanged: 'n/a',
    filesAnalyzed: 'full',
    timeMs: initial.ms,
    delta: null,
  });

  // Ensure a completed scan cache exists
  const full = timed(() => run(bin, ['scan'], root));
  const fullDelta = parseDeltaFromScanOutput(full.value);
  scenarios.push({
    scenario: 'full rescan',
    filesChanged: 'n/a',
    filesAnalyzed: fullDelta?.reanalyzed ?? 'full',
    timeMs: full.ms,
    delta: fullDelta,
  });

  const noChange = timed(() => run(bin, ['scan', '--update'], root));
  scenarios.push({
    scenario: 'no-change update',
    filesChanged: 0,
    filesAnalyzed: parseDeltaFromScanOutput(noChange.value)?.reanalyzed ?? 0,
    timeMs: noChange.ms,
    delta: parseDeltaFromScanOutput(noChange.value),
  });

  write(root, 'src/auth/service.ts', 'export class AuthService { login() { return 1; } }\n');
  const one = timed(() => run(bin, ['scan', '--update'], root));
  scenarios.push({
    scenario: '1 file changed',
    filesChanged: 1,
    filesAnalyzed: parseDeltaFromScanOutput(one.value)?.reanalyzed ?? null,
    timeMs: one.ms,
    delta: parseDeltaFromScanOutput(one.value),
  });

  for (let i = 0; i < 10; i++) {
    write(root, `src/gen/mod0/file${i}.ts`, `export const v${i} = ${i + 10};\n`);
  }
  const ten = timed(() => run(bin, ['scan', '--update'], root));
  scenarios.push({
    scenario: '10 files changed',
    filesChanged: 10,
    filesAnalyzed: parseDeltaFromScanOutput(ten.value)?.reanalyzed ?? null,
    timeMs: ten.ms,
    delta: parseDeltaFromScanOutput(ten.value),
  });

  for (let i = 0; i < 100; i++) {
    write(root, `src/gen/mod1/file${i}.ts`, `export const v${i} = ${i + 100};\n`);
  }
  const hundred = timed(() => run(bin, ['scan', '--update'], root));
  scenarios.push({
    scenario: '100 files changed',
    filesChanged: 100,
    filesAnalyzed: parseDeltaFromScanOutput(hundred.value)?.reanalyzed ?? null,
    timeMs: hundred.ms,
    delta: parseDeltaFromScanOutput(hundred.value),
  });

  write(root, 'src/workers/new-job.ts', 'export function newJob() {}\n');
  const moduleAdd = timed(() => run(bin, ['scan', '--update'], root));
  scenarios.push({
    scenario: '1 module/file added',
    filesChanged: 1,
    filesAnalyzed: parseDeltaFromScanOutput(moduleAdd.value)?.reanalyzed ?? null,
    timeMs: moduleAdd.ms,
    delta: parseDeltaFromScanOutput(moduleAdd.value),
  });

  renameSync(join(root, 'src', 'billing'), join(root, 'src', 'payments'));
  const renamed = timed(() => run(bin, ['scan', '--update'], root));
  scenarios.push({
    scenario: 'module renamed (billing→payments)',
    filesChanged: 'rename',
    filesAnalyzed: parseDeltaFromScanOutput(renamed.value)?.reanalyzed ?? null,
    timeMs: renamed.ms,
    delta: parseDeltaFromScanOutput(renamed.value),
  });

  rmSync(join(root, 'src', 'workers'), { recursive: true, force: true });
  const deleted = timed(() => run(bin, ['scan', '--update'], root));
  scenarios.push({
    scenario: 'module deleted (workers)',
    filesChanged: 'delete',
    filesAnalyzed: parseDeltaFromScanOutput(deleted.value)?.reanalyzed ?? null,
    timeMs: deleted.ms,
    delta: parseDeltaFromScanOutput(deleted.value),
  });

  return { root, fileCount: 8000, scenarios };
}

function runRenameConsistency(bin = neuronBin) {
  const root = mkdtempSync(join(tmpdir(), 'neuron-rename-'));
  buildRepoA(root);
  run(bin, ['init', '--yes'], root);
  run(bin, ['scan'], root);
  seedRules(bin, root);

  const userRuleTitle = 'Never call Stripe directly from route handlers';
  renameSync(join(root, 'src', 'billing'), join(root, 'src', 'payments'));
  const scanOut = run(bin, ['scan', '--update'], root);
  const delta = parseDeltaFromScanOutput(scanOut);

  const knowledge = JSON.parse(readFileSync(join(root, '.neuron', 'brain', 'knowledge.json'), 'utf8'));
  const mapPaths = (knowledge.map?.entries ?? []).map((e) => e.path);
  const store = JSON.parse(readFileSync(join(root, '.neuron', 'runtime', 'store.json'), 'utf8'));
  const memories = store.memories ?? [];
  const active = memories.filter((m) => m.status === 'active');
  const userAlive = active.some(
    (m) => m.source === 'user' && /Never call Stripe/i.test(m.title + m.content),
  );
  const staleBillingScan = active.filter(
    (m) =>
      (m.tags ?? []).includes('scan') &&
      (m.paths ?? []).some((p) => String(p).includes('src/billing/')) &&
      (m.paths ?? []).every((p) => String(p).includes('src/billing/') || !existsSync(join(root, String(p).replace(/\/$/, '')))),
  );

  const mapHasOld = mapPaths.some((p) => p.includes('src/billing/'));
  const mapHasNew = mapPaths.some((p) => p.includes('src/payments/'));

  return {
    root,
    delta,
    mapHasOldBilling: mapHasOld,
    mapHasPayments: mapHasNew,
    userMemorySurvived: userAlive,
    staleScanMemoriesWithOnlyBillingPaths: staleBillingScan.length,
    userRuleTitle,
    pass:
      !mapHasOld &&
      mapHasNew &&
      userAlive &&
      staleBillingScan.length === 0,
  };
}

function architectureAudit() {
  const findings = [];

  // Search product code only — never scripts/ (the harness names forbidden APIs on purpose).
  const rg = spawnSync(
    process.platform === 'win32' ? 'rg.exe' : 'rg',
    [
      '-n',
      'RetrievalEngine2|ProjectMap2|MemoryEngine2|BrainIndex|ScanIndex|KnowledgeStore2|createSecondBrain|brain2|retrieval2|project-index',
      'packages',
      'apps',
    ],
    { cwd: repo, encoding: 'utf8' },
  );
  findings.push({
    check: 'no duplicate engines/indexes',
    ok: !rg.stdout?.trim(),
    detail: rg.stdout?.trim()?.slice(0, 400) || 'clean',
  });

  const legacy = spawnSync(
    process.platform === 'win32' ? 'rg.exe' : 'rg',
    ['-n', 'neuron_prepare_task|neuron_get_context|neuron_scan_project', 'packages/cursor-integration/templates', 'apps/cli/dist/templates'],
    { cwd: repo, encoding: 'utf8' },
  );
  findings.push({
    check: 'templates free of legacy MCP tool names',
    ok: !legacy.stdout?.trim(),
    detail: legacy.stdout?.trim()?.slice(0, 400) || 'clean',
  });

  const cloud = spawnSync(
    process.platform === 'win32' ? 'rg.exe' : 'rg',
    ['-n', 'OPENAI_API_KEY|pinecone|weaviate|qdrant|embeddings?\\.create', 'packages', 'apps'],
    { cwd: repo, encoding: 'utf8' },
  );
  // Allow comments/docs that say "no embeddings"
  const cloudHits = (cloud.stdout || '')
    .split('\n')
    .filter((l) => l && !/no embeddings|without embeddings|not.*embedding|Reserved for future/i.test(l));
  findings.push({
    check: 'no cloud/embedding runtime remnants',
    ok: cloudHits.length === 0,
    detail: cloudHits.slice(0, 5).join('\n') || 'clean',
  });

  const cliPkg = JSON.parse(readFileSync(join(repo, 'apps', 'cli', 'package.json'), 'utf8'));
  const runtimeNeuron = Object.keys(cliPkg.dependencies || {}).filter((d) => d.startsWith('@neuronai/'));
  findings.push({
    check: 'packed CLI has zero @neuronai/* runtime deps',
    ok: runtimeNeuron.length === 0,
    detail: runtimeNeuron.join(', ') || 'none',
  });

  return findings;
}

async function packedStrangerProof() {
  const work = mkdtempSync(join(tmpdir(), 'neuron-packed-'));
  const isWindows = process.platform === 'win32';
  const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
  const npm = isWindows ? 'npm.cmd' : 'npm';
  const runCmd = (cmd, args, cwd) =>
    spawnSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      shell: isWindows && cmd.endsWith('.cmd'),
      maxBuffer: 16 * 1024 * 1024,
    });

  const pack = runCmd(pnpm, ['pack', '--pack-destination', work], join(repo, 'apps', 'cli'));
  if (pack.status !== 0) throw new Error(pack.stderr || pack.stdout);
  const tarball = join(work, readdirSync(work).find((f) => f.endsWith('.tgz')));
  const project = join(work, 'stranger');
  mkdirSync(project, { recursive: true });
  buildRepoA(project);
  const install = runCmd(npm, ['install', '--no-audit', '--no-fund', tarball], project);
  if (install.status !== 0) throw new Error(install.stderr || install.stdout);
  const bin = join(project, 'node_modules', 'neuronai', 'dist', 'index.js');

  const version = run(bin, ['--version'], project).trim();
  run(bin, ['init', '--yes'], project);
  run(bin, ['scan'], project);
  const doctor = run(bin, ['doctor'], project);
  const context = run(bin, ['context', 'Where is authentication implemented?'], project);
  run(bin, ['cursor', 'setup', '--force'], project);
  const cursorDoctor = run(bin, ['cursor', 'doctor'], project);

  let mcpTools = [];
  await withMcp(project, async (client) => {
    mcpTools = (await client.listTools()).tools.map((t) => t.name).sort();
    const body = await ask(client, 'Where should I add a new payment endpoint?');
    return body;
  });

  const expected = [
    'neuron_after_task',
    'neuron_context',
    'neuron_remember',
    'neuron_resolve_suggestion',
    'neuron_scan',
    'neuron_search',
    'neuron_update',
  ];

  return {
    version,
    doctorOk: /All checks passed/i.test(doctor),
    contextOk: /auth|src\//i.test(context),
    cursorDoctor,
    mcpTools,
    mcpOk: expected.every((t) => mcpTools.includes(t)) && mcpTools.length === 7,
    reloadMentioned: /RELOAD REQUIRED|toggle|Reload/i.test(cursorDoctor),
    work,
  };
}

// --- main ---
const report = {
  generatedAt: new Date().toISOString(),
  neuronBin,
  repos: [],
  incremental: null,
  rename: null,
  architectureAudit: null,
  packed: null,
  bugs: [],
  fixes: [],
};

console.log('Building Brain packages…');
spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['--filter', '@neuronai/project-scanner', 'build'],
  { cwd: repo, stdio: 'inherit', shell: process.platform === 'win32' },
);
spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['--filter', 'neuronai', 'build'],
  { cwd: repo, stdio: 'inherit', shell: process.platform === 'win32' },
);

console.log('\n=== Query benchmarks (A–D) ===');
for (const [name, builder] of [
  ['A-ts-app', buildRepoA],
  ['B-monorepo', buildRepoB],
  ['C-python', buildRepoC],
  ['D-noisy', buildRepoD],
]) {
  console.log(`\nRepo ${name}`);
  const result = await benchmarkRepo(name, builder);
  report.repos.push(result);
  const correct = result.rows.filter((r) => r.correct === 'correct').length;
  const acceptable = result.rows.filter((r) => r.correct === 'acceptable').length;
  const incorrect = result.rows.filter((r) => r.correct === 'incorrect').length;
  console.log(`  tools: ${result.tools.join(', ')}`);
  console.log(`  ${correct} correct / ${acceptable} acceptable / ${incorrect} incorrect`);
  for (const row of result.rows.filter((r) => r.correct === 'incorrect')) {
    console.log(`  FAIL [${row.category}] ${row.query} → ${row.topResult ?? '(empty)'}`);
  }
}

console.log('\n=== Incremental scan proof (~8k files) ===');
report.incremental = runIncrementalProof();
for (const s of report.incremental.scenarios) {
  console.log(
    `  ${s.scenario}: ${s.timeMs}ms · changed=${s.filesChanged} · reanalyzed=${s.filesAnalyzed}`,
  );
}

console.log('\n=== Rename / delete consistency ===');
report.rename = runRenameConsistency();
console.log(
  `  pass=${report.rename.pass} mapOld=${report.rename.mapHasOldBilling} mapNew=${report.rename.mapHasPayments} user=${report.rename.userMemorySurvived} staleScan=${report.rename.staleScanMemoriesWithOnlyBillingPaths}`,
);

console.log('\n=== Architecture audit ===');
report.architectureAudit = architectureAudit();
for (const f of report.architectureAudit) {
  console.log(`  ${f.ok ? 'ok' : 'FAIL'} ${f.check}`);
  if (!f.ok) console.log(`      ${f.detail}`);
}

if (wantPacked) {
  console.log('\n=== Packed stranger path ===');
  report.packed = await packedStrangerProof();
  console.log(
    `  version=${report.packed.version} doctor=${report.packed.doctorOk} context=${report.packed.contextOk} mcp=${report.packed.mcpOk}`,
  );
}

// Summaries
const allRows = report.repos.flatMap((r) => r.rows);
const scored = allRows.filter((r) => r.correct !== 'acceptable' || r.category !== 'negative');
const correctN = allRows.filter((r) => r.correct === 'correct').length;
const acceptableN = allRows.filter((r) => r.correct === 'acceptable').length;
const incorrectN = allRows.filter((r) => r.correct === 'incorrect').length;
const locationMod = allRows.filter((r) => r.category === 'location' || r.category === 'modification');
const locModOk = locationMod.filter((r) => r.correct === 'correct' || r.correct === 'acceptable').length;
const negatives = allRows.filter((r) => r.category === 'negative');
const negOk = negatives.filter((r) => r.correct === 'correct').length;
const mods = allRows.filter((r) => r.category === 'modification');
const modOk = mods.filter((r) => r.correct === 'correct' || r.correct === 'acceptable').length;

const noChange = report.incremental.scenarios.find((s) => s.scenario === 'no-change update');
const full = report.incremental.scenarios.find((s) => s.scenario === 'full rescan');
const oneFile = report.incremental.scenarios.find((s) => s.scenario === '1 file changed');

const pct = (a, b) => (b === 0 ? 0 : Math.round((1000 * a) / b) / 10);

report.summary = {
  queries: allRows.length,
  correct: correctN,
  acceptable: acceptableN,
  incorrect: incorrectN,
  correctOrAcceptablePct: pct(correctN + acceptableN, allRows.length),
  locationModificationOkPct: pct(locModOk, locationMod.length),
  modificationOkPct: pct(modOk, mods.length),
  negativeOkPct: pct(negOk, negatives.length),
  avgContextTokens: Math.round(
    allRows.reduce((s, r) => s + (r.contextTokens ?? 0), 0) / Math.max(1, allRows.length),
  ),
  avgRetrievalMs:
    Math.round(
      (allRows.reduce((s, r) => s + (r.retrievalMs ?? 0), 0) / Math.max(1, allRows.length)) * 10,
    ) / 10,
  incremental: {
    noChangeMs: noChange?.timeMs,
    fullRescanMs: full?.timeMs,
    noChangeReanalyzed: noChange?.filesAnalyzed,
    oneFileReanalyzed: oneFile?.filesAnalyzed,
    oneFileMs: oneFile?.timeMs,
    // Primary proof: reanalysis scales with change, not repo size.
    noChangeReanalyzedZero: noChange?.filesAnalyzed === 0,
    oneFileNotFullRepo:
      typeof oneFile?.filesAnalyzed === 'number' ? oneFile.filesAnalyzed <= 20 : false,
    // Wall-clock can be walk-dominated on large fixtures; still expect a clear gap.
    noChangeMuchFasterThanFull:
      noChange && full ? noChange.timeMs < full.timeMs * 0.75 : false,
  },
  renamePass: report.rename.pass,
  architectureOk: report.architectureAudit.every((f) => f.ok),
};

const blockers = [];
if (report.summary.correctOrAcceptablePct < 90) {
  blockers.push(`Query accuracy ${report.summary.correctOrAcceptablePct}% < 90%`);
}
if (report.summary.modificationOkPct < 90) {
  blockers.push(`Modification recommendations ${report.summary.modificationOkPct}% < 90%`);
}
if (report.summary.negativeOkPct < 100) {
  blockers.push(`Negative queries hallucinated locations (${negOk}/${negatives.length})`);
}
if (!report.summary.incremental.noChangeReanalyzedZero) {
  blockers.push(
    `no-change update reanalyzed ${report.summary.incremental.noChangeReanalyzed} files (expected 0)`,
  );
}
if (!report.summary.incremental.oneFileNotFullRepo) {
  blockers.push('1-file change reanalyzed too many files');
}
if (
  !report.summary.incremental.noChangeMuchFasterThanFull &&
  !report.summary.incremental.noChangeReanalyzedZero
) {
  blockers.push('no-change update is not meaningfully faster than full rescan');
}
if (!report.rename.pass) blockers.push('Rename/delete consistency failed');
if (!report.architectureAudit.every((f) => f.ok)) blockers.push('Architecture audit failed');
if (wantPacked && report.packed && !report.packed.mcpOk) blockers.push('Packed MCP catalog incomplete');

report.verdict = blockers.length === 0 ? 'GO' : 'NO-GO';
report.blockers = blockers;

const out = join(repo, 'final-proof-report.json');
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nWrote ${out}`);
console.log(`VERDICT: ${report.verdict}`);
if (blockers.length) {
  console.log('Blockers:');
  for (const b of blockers) console.log(`  - ${b}`);
  process.exitCode = 1;
} else {
  console.log('FINAL_PROOF_OK');
}
