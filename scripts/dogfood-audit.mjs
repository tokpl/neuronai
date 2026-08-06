/**
 * P0.1 real-world dogfood harness.
 *
 * Builds a realistic multi-module shop, runs the published-style CLI + MCP path,
 * asks 20 developer questions, mutates the tree, and writes an audit JSON.
 *
 * Usage: node scripts/dogfood-audit.mjs
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const neuronBin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

function run(args, cwd, input) {
  const r = spawnSync(node, [neuronBin, ...args], {
    cwd,
    encoding: 'utf8',
    input,
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`neuron ${args.join(' ')} failed\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout;
}

function write(root, rel, body) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function buildRealisticProject(root) {
  write(
    root,
    'package.json',
    JSON.stringify(
      {
        name: 'acme-commerce',
        version: '3.2.1',
        type: 'module',
        dependencies: {
          express: '^4.21.0',
          stripe: '^17.0.0',
          pg: '^8.13.0',
          'drizzle-orm': '^0.36.0',
          jsonwebtoken: '^9.0.0',
          zod: '^3.23.0',
          dotenv: '^16.4.0',
        },
        devDependencies: { vitest: '^2.0.0', typescript: '^5.6.0' },
      },
      null,
      2,
    ),
  );

  write(
    root,
    'README.md',
    [
      '# Acme Commerce',
      '',
      'Storefront and billing platform.',
      '',
      '## Architecture',
      '',
      '- HTTP routes are thin and live under `src/api/routes`.',
      '- Business logic belongs in services under each domain module.',
      '- Database access stays inside repositories.',
      '- Authentication uses JWT via AuthService and auth middleware.',
      '- Stripe is accessed only through PaymentService / BillingService — never from routes.',
      '- Invoice cancellation must emit an audit event.',
      '',
      '## Modules',
      '',
      '- auth, billing, payments, invoices, users, api, config, db',
    ].join('\n'),
  );

  write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true } }, null, 2));
  write(root, '.env.example', 'DATABASE_URL=postgres://localhost/acme\nSTRIPE_SECRET=sk_test\n');
  write(root, 'drizzle.config.ts', "export default { schema: './src/db/schema.ts' };\n");

  write(
    root,
    'src/config/env.ts',
    `import 'dotenv/config';\nexport function loadConfig() {\n  return { databaseUrl: process.env.DATABASE_URL, stripeSecret: process.env.STRIPE_SECRET };\n}\n`,
  );
  write(
    root,
    'src/db/schema.ts',
    `export const users = { table: 'users' };\nexport const invoices = { table: 'invoices' };\nexport const payments = { table: 'payments' };\n`,
  );
  write(
    root,
    'src/db/client.ts',
    `export class DatabaseClient {\n  query(_sql: string) { return []; }\n}\n`,
  );

  write(
    root,
    'src/auth/service.ts',
    `export class AuthService {\n  async login() {}\n  async verifyToken() {}\n}\nexport function createAuthService() { return new AuthService(); }\n`,
  );
  write(
    root,
    'src/auth/middleware.ts',
    `export function authenticateRequest(req: unknown) { return req; }\nexport function authMiddleware() { return authenticateRequest; }\n`,
  );
  write(
    root,
    'src/auth/jwt.ts',
    `export function signToken(payload: object) { return 'jwt'; }\nexport function verifyToken(token: string) { return {}; }\n`,
  );

  write(
    root,
    'src/users/service.ts',
    `export class UserService {\n  async createUser() {}\n  async findByEmail() {}\n}\n`,
  );
  write(
    root,
    'src/users/repository.ts',
    `export class UserRepository {\n  async insert() {}\n  async findById() {}\n}\n`,
  );

  write(
    root,
    'src/billing/service.ts',
    `export class BillingService {\n  async createSubscription() {}\n  async cancelSubscription() {}\n  async mutateBilling() {}\n}\n`,
  );
  write(
    root,
    'src/billing/routes.ts',
    `import { Router } from 'express';\nexport const billingRouter = Router();\nbillingRouter.post('/billing/subscribe', () => {});\nbillingRouter.post('/billing/cancel', () => {});\n`,
  );
  write(
    root,
    'src/billing/invoices/service.ts',
    `export class InvoiceService {\n  async createInvoice() {}\n  async cancelInvoice() {}\n  async emitAuditEvent() {}\n}\nexport function cancelInvoice() {}\n`,
  );
  write(
    root,
    'src/billing/invoices/repository.ts',
    `export class InvoiceRepository {\n  async save() {}\n  async markCancelled() {}\n}\n`,
  );
  write(
    root,
    'src/billing/invoices/validation.ts',
    `export function validateInvoiceInput(input: unknown) { return input; }\n`,
  );

  write(
    root,
    'src/payments/service.ts',
    `export class PaymentService {\n  async charge() {}\n  async refund() {}\n  async createPaymentIntent() {}\n}\n`,
  );
  write(
    root,
    'src/payments/stripe.ts',
    `export class StripeClient {\n  async charge() {}\n}\nexport function createStripeClient() { return new StripeClient(); }\n`,
  );
  write(
    root,
    'src/payments/repository.ts',
    `export class PaymentRepository {\n  async record() {}\n}\n`,
  );

  write(
    root,
    'src/api/routes/index.ts',
    `export { usersRouter } from './users.js';\nexport { healthRouter } from './health.js';\n`,
  );
  write(
    root,
    'src/api/routes/users.ts',
    `import { Router } from 'express';\nexport const usersRouter = Router();\nusersRouter.post('/api/users', () => {});\n`,
  );
  write(
    root,
    'src/api/routes/health.ts',
    `import { Router } from 'express';\nexport const healthRouter = Router();\nhealthRouter.get('/health', () => {});\n`,
  );
  write(
    root,
    'src/api/server.ts',
    `import express from 'express';\nexport function createServer() { return express(); }\n`,
  );

  // Similar-name noise for false-positive testing
  write(root, 'src/billing-ui/Badge.tsx', `export function BillingBadge() { return null; }\n`);
  write(root, 'src/billing-admin/page.tsx', `export function BillingAdminPage() { return null; }\n`);
  write(root, 'docs/billing.md', `# Billing docs\n\nHigh-level product notes.\n`);
  write(root, 'tests/billing.test.ts', `import { describe, it } from 'vitest';\ndescribe('billing', () => { it('placeholder', () => {}); });\n`);
  write(
    root,
    'tests/payments/PaymentService.test.ts',
    `import { describe, it } from 'vitest';\ndescribe('PaymentService', () => { it('charges', () => {}); });\n`,
  );
  write(
    root,
    'tests/auth/AuthService.test.ts',
    `import { describe, it } from 'vitest';\ndescribe('AuthService', () => { it('logs in', () => {}); });\n`,
  );
}

/** Expected relevance hints for scoring — not a second retrieval engine. */
const QUERIES = [
  {
    category: 'location',
    q: 'Where is authentication implemented?',
    expectPaths: [/src\/auth/],
    expectNot: [/billing-ui/, /kubernetes/i],
  },
  {
    category: 'location',
    q: 'Where are API routes defined?',
    expectPaths: [/src\/api\/routes/],
    expectNot: [/billing-docs|docs\/billing/],
  },
  {
    category: 'location',
    q: 'Where is billing implemented?',
    expectPaths: [/src\/billing/],
    expectNot: [/weather/i],
  },
  {
    category: 'location',
    q: 'Where is database access?',
    expectPaths: [/src\/db|repository/i],
    expectNot: [/billing-ui/],
  },
  {
    category: 'location',
    q: 'Where is the payment integration?',
    expectPaths: [/src\/payments|stripe/i],
    expectNot: [],
  },
  {
    category: 'location',
    q: 'Where is configuration loaded?',
    expectPaths: [/src\/config|env/i],
    expectNot: [],
  },
  {
    category: 'modification',
    q: 'Where should I add a new payment endpoint?',
    expectPaths: [/billing|payments|routes/i],
    expectNot: [/weather/i],
  },
  {
    category: 'modification',
    q: 'Where should validation for invoices go?',
    expectPaths: [/invoice|validation|billing/i],
    expectNot: [],
  },
  {
    category: 'modification',
    q: 'Where should I add a new authentication provider?',
    expectPaths: [/src\/auth/],
    expectNot: [/payments\/stripe/],
  },
  {
    category: 'modification',
    q: 'Where should I modify the billing logic?',
    expectPaths: [/src\/billing/],
    expectNot: [/billing-ui/],
  },
  {
    category: 'modification',
    q: 'Where should I add a test for PaymentService?',
    expectPaths: [/PaymentService|tests\/payments|payments/i],
    expectNot: [],
  },
  {
    category: 'architecture',
    q: 'How is authentication structured?',
    expectPaths: [/auth/i],
    expectNot: [],
  },
  {
    category: 'architecture',
    q: 'How does billing flow through the application?',
    expectPaths: [/billing|payment/i],
    expectNot: [],
  },
  {
    category: 'architecture',
    q: 'What layer owns database access?',
    expectPaths: [/repositor|db/i],
    expectNot: [],
  },
  {
    category: 'architecture',
    q: 'How are API requests handled?',
    expectPaths: [/api|route|service/i],
    expectNot: [],
  },
  {
    category: 'architecture',
    q: 'What conventions does this project follow?',
    expectPaths: [/service|repositor|route|middleware/i],
    expectNot: [/weather/i],
  },
  {
    category: 'rules',
    q: 'What rule applies to payment code?',
    expectPaths: [/payment|stripe|route|service/i],
    expectNot: [],
  },
  {
    category: 'rules',
    q: 'What decision was made about authentication?',
    expectPaths: [/auth|jwt|middleware/i],
    expectNot: [],
  },
  {
    category: 'rules',
    q: 'What should I avoid when modifying billing?',
    expectPaths: [/billing|payment|stripe|route/i],
    expectNot: [],
  },
  {
    category: 'unrelated',
    q: 'What is the weather tomorrow?',
    expectPaths: [],
    expectEmpty: true,
  },
  {
    category: 'unrelated',
    q: 'How do I deploy this to Kubernetes?',
    expectPaths: [],
    expectEmptyish: true,
  },
  {
    category: 'unrelated',
    q: 'What is React?',
    expectPaths: [],
    expectEmptyish: true,
  },
];

function blobOf(body) {
  return [
    body.context ?? '',
    JSON.stringify(body.relevantFiles ?? []),
    JSON.stringify(body.relevantModules ?? []),
    JSON.stringify(body.relevantRules ?? []),
    JSON.stringify(body.recommendation ?? {}),
  ].join('\n');
}

function scoreRow(spec, body) {
  const blob = blobOf(body);
  const empty =
    /No stored project knowledge matched/i.test(body.context ?? '') &&
    !(body.relevantFiles?.length || body.relevantModules?.length || body.relevantRules?.length);

  let correct = 'incorrect';
  if (spec.expectEmpty) {
    correct = empty ? 'correct' : 'incorrect';
  } else if (spec.expectEmptyish) {
    correct = empty || !(body.recommendation || (body.relevantFiles?.length ?? 0) > 3)
      ? 'correct'
      : 'incorrect';
  } else {
    const hit = (spec.expectPaths ?? []).some((re) => re.test(blob));
    const noise = (spec.expectNot ?? []).some((re) => re.test(blob));
    if (hit && !noise) correct = 'correct';
    else if (hit && noise) correct = 'acceptable';
    else correct = 'incorrect';
  }

  // Rediscovery heuristic: enough concrete paths for location/modification
  let rediscovery = 'N/A';
  if (spec.category === 'location' || spec.category === 'modification') {
    const hasPath = /src\/[a-z0-9_./-]+/i.test(blob);
    if (correct === 'incorrect' || !hasPath) rediscovery = 'NO';
    else if (correct === 'acceptable') rediscovery = 'PARTIALLY';
    else rediscovery = 'YES';
  } else if (spec.category === 'architecture' || spec.category === 'rules') {
    rediscovery = /src\/|Rules:|Constraints|Recommended/i.test(blob) ? 'YES' : 'PARTIALLY';
  } else if (spec.category === 'unrelated') {
    rediscovery = empty || correct === 'correct' ? 'YES' : 'NO';
  }

  const paths = [
    ...(body.relevantModules ?? []).map((m) => m.path),
    ...(body.relevantFiles ?? []).map((f) => f.path),
    body.recommendation?.path,
  ].filter(Boolean);

  const primaryNoise = paths.filter((p) =>
    /billing-ui|billing-admin|docs\/billing/i.test(String(p)),
  );

  return { correct, rediscovery, noisePaths: primaryNoise, empty };
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
  const client = new Client({ name: 'dogfood-audit', version: '0.0.0' });
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

const root = mkdtempSync(join(tmpdir(), 'neuron-dogfood-'));
console.log(`fixture: ${root}`);
buildRealisticProject(root);

run(['init', '--yes'], root);
run(['scan'], root);
run(['cursor', 'setup', '--force'], root);

// Seed durable rules via CLI remember (same ProjectBrain path)
run(
  [
    'remember',
    'Never call Stripe directly from route handlers.',
    '--yes',
    '--type',
    'business_rule',
  ],
  root,
);
run(
  [
    'remember',
    'All billing mutations go through BillingService.',
    '--yes',
    '--type',
    'business_rule',
  ],
  root,
);
run(
  [
    'remember',
    'Authentication uses the AuthService abstraction.',
    '--yes',
    '--type',
    'business_rule',
  ],
  root,
);
run(
  [
    'remember',
    'Database access must stay inside repositories.',
    '--yes',
    '--type',
    'business_rule',
  ],
  root,
);

const rows = [];
await withMcp(root, async (client) => {
  const listed = await client.listTools();
  console.log(
    'MCP tools:',
    listed.tools
      .map((t) => t.name)
      .sort()
      .join(', '),
  );

  for (const spec of QUERIES) {
    const body = await ask(client, spec.q);
    const scored = scoreRow(spec, body);
    const row = {
      category: spec.category,
      query: spec.q,
      intent: body.intent,
      modules: (body.relevantModules ?? []).map((m) => m.path),
      files: (body.relevantFiles ?? []).map((f) => `${f.path}${f.kind === 'symbol' ? ` (${f.name})` : ''}`),
      symbols: (body.relevantFiles ?? [])
        .filter((f) => f.kind === 'symbol')
        .map((f) => f.name),
      rules: (body.relevantRules ?? []).map((r) => r.title),
      recommendation: body.recommendation
        ? { path: body.recommendation.path, reason: body.recommendation.reason }
        : null,
      contextTokens: body.metrics?.contextTokens,
      corpusTokens: body.metrics?.corpusTokens,
      estimatedTokensSaved: body.metrics?.estimatedTokensSaved,
      retrievalMs: body.metrics?.retrievalMs,
      correct: scored.correct,
      rediscovery: scored.rediscovery,
      noisePaths: scored.noisePaths,
      contextPreview: String(body.context ?? '').slice(0, 400),
    };
    rows.push(row);
    console.log(
      `[${row.correct}/${row.rediscovery}] ${spec.category}: ${spec.q} → ${row.recommendation?.path ?? row.modules[0] ?? row.files[0] ?? '(empty)'} (${row.contextTokens} tok, ${row.retrievalMs}ms)`,
    );
  }

  // Coherent payment-endpoint recommendation after memories
  const payment = await ask(client, 'Where should I add a new payment endpoint?');
  const paymentBlob = blobOf(payment);
  const coherent = {
    hasLocation: /src\/(billing|payments|api)/i.test(paymentBlob),
    hasService: /BillingService|PaymentService|service\.ts/i.test(paymentBlob),
    hasRule: /Stripe|route handlers|BillingService|payment/i.test(paymentBlob),
    hasRecommendation: Boolean(payment.recommendation?.path),
    body: {
      recommendation: payment.recommendation,
      rules: (payment.relevantRules ?? []).map((r) => r.title),
      files: (payment.relevantFiles ?? []).map((f) => f.path),
      modules: (payment.relevantModules ?? []).map((m) => m.path),
      metrics: payment.metrics,
      context: payment.context,
    },
  };
  writeFileSync(join(root, 'coherent-payment.json'), `${JSON.stringify(coherent, null, 2)}\n`);
  console.log('coherent payment endpoint:', coherent);
});

// --- Mutations + incremental scan ---
const mutation = { before: {}, after: {} };
mutation.before.map = JSON.parse(readFileSync(join(root, '.neuron', 'brain', 'knowledge.json'), 'utf8')).map
  ?.entries?.length;
renameSync(join(root, 'src', 'billing'), join(root, 'src', 'payments-domain'));
// Move a service
mkdirSync(join(root, 'src', 'payments-domain', 'core'), { recursive: true });
renameSync(
  join(root, 'src', 'payments-domain', 'service.ts'),
  join(root, 'src', 'payments-domain', 'core', 'service.ts'),
);
rmSync(join(root, 'src', 'api', 'routes', 'health.ts'), { force: true });
write(
  root,
  'src/notifications/service.ts',
  `export class NotificationService {\n  async send() {}\n}\n`,
);
write(
  root,
  'src/payments/service.ts',
  `export class CheckoutService {\n  async charge() {}\n}\n`,
); // symbol rename: PaymentService → CheckoutService

const incrStarted = Date.now();
run(['scan', '--update'], root);
mutation.incrementalMs = Date.now() - incrStarted;

const mapAfter = JSON.parse(readFileSync(join(root, '.neuron', 'brain', 'knowledge.json'), 'utf8'))
  .map?.entries ?? [];
mutation.after = {
  mapCount: mapAfter.length,
  hasOldBillingDir: mapAfter.some((e) => e.path.includes('src/billing/') && !e.path.includes('billing-')),
  hasPaymentsDomain: mapAfter.some((e) => e.path.includes('src/payments-domain')),
  hasDeletedHealth: mapAfter.some((e) => e.path.includes('health.ts')),
  hasNotifications: mapAfter.some((e) => e.path.includes('notifications')),
  hasPaymentServiceSymbol: mapAfter.some((e) => e.name === 'PaymentService'),
  hasCheckoutServiceSymbol: mapAfter.some((e) => e.name === 'CheckoutService'),
};

await withMcp(root, async (client) => {
  const afterBilling = await ask(client, 'Where is billing implemented?');
  mutation.afterBillingQuery = {
    modules: (afterBilling.relevantModules ?? []).map((m) => m.path),
    files: (afterBilling.relevantFiles ?? []).map((f) => f.path),
    recommendation: afterBilling.recommendation?.path,
    contextHasSrcBilling: /src\/billing\//.test(afterBilling.context ?? ''),
    contextHasPaymentsDomain: /payments-domain/.test(blobOf(afterBilling)),
  };
});

// Scale probe: duplicate modules to approximate larger surface, time context only
const scale = {};
for (const size of ['small', 'medium', 'large']) {
  const n = size === 'small' ? 0 : size === 'medium' ? 40 : 120;
  const scaleRoot = mkdtempSync(join(tmpdir(), `neuron-scale-${size}-`));
  buildRealisticProject(scaleRoot);
  for (let i = 0; i < n; i++) {
    write(
      scaleRoot,
      `src/gen/module${i}/service.ts`,
      `export class GenService${i} { run() {} }\nexport function helper${i}() {}\n`,
    );
  }
  const scanStarted = Date.now();
  run(['init', '--yes'], scaleRoot);
  const scanMs = Date.now() - scanStarted;
  // touch one file then incremental
  write(scaleRoot, 'src/gen/module0/service.ts', `export class GenService0 { run() { return 1; } }\n`);
  const incrStart = Date.now();
  run(['scan', '--update'], scaleRoot);
  const incrMs = Date.now() - incrStart;
  await withMcp(scaleRoot, async (client) => {
    const body = await ask(client, 'Where is authentication implemented?');
    scale[size] = {
      generatedModules: n,
      scanMs,
      incrementalMs: incrMs,
      contextTokens: body.metrics?.contextTokens,
      retrievalMs: body.metrics?.retrievalMs,
    };
  });
  rmSync(scaleRoot, { recursive: true, force: true });
  console.log('scale', size, scale[size]);
}

const summary = {
  fixture: root,
  totals: {
    queries: rows.length,
    correct: rows.filter((r) => r.correct === 'correct').length,
    acceptable: rows.filter((r) => r.correct === 'acceptable').length,
    incorrect: rows.filter((r) => r.correct === 'incorrect').length,
    rediscoveryYes: rows.filter((r) => r.rediscovery === 'YES').length,
    rediscoveryPartial: rows.filter((r) => r.rediscovery === 'PARTIALLY').length,
    rediscoveryNo: rows.filter((r) => r.rediscovery === 'NO').length,
    avgContextTokens: Math.round(
      rows.reduce((s, r) => s + (r.contextTokens ?? 0), 0) / Math.max(1, rows.length),
    ),
    avgRetrievalMs: Math.round(
      (rows.reduce((s, r) => s + (r.retrievalMs ?? 0), 0) / Math.max(1, rows.length)) * 10,
    ) / 10,
  },
  rows,
  mutation,
  scale,
};

const outPath = join(repo, 'dogfood-audit-report.json');
writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\nWrote ${outPath}`);
console.log(JSON.stringify(summary.totals, null, 2));
console.log('mutation', JSON.stringify(mutation.after, null, 2));
console.log('DOGFOOD_OK');
