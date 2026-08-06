#!/usr/bin/env node
/**
 * Daily-use product audit — realistic developer questions against a rich fixture.
 * Labels LIVE_AGENT_PROOF = UNAVAILABLE; this measures Brain context quality only.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

function write(root, rel, body = '') {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function buildBackend(root) {
  write(root, 'package.json', JSON.stringify({ name: 'acme-api', type: 'module' }));
  write(
    root,
    'src/api/routes/payments.ts',
    `import { Router } from 'express';
import { PaymentService } from '../../services/payment-service.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();
const payments = new PaymentService();

export function createPaymentHandler(req: any, res: any) {
  return payments.createPayment(req.body);
}

export function cancelInvoiceHandler(req: any, res: any) {
  return payments.cancelInvoice(req.params.id);
}

router.post('/payments', requireAuth, createPaymentHandler);
router.post('/invoices/:id/cancel', requireAuth, cancelInvoiceHandler);
export default router;
`,
  );
  write(
    root,
    'src/services/payment-service.ts',
    `import { StripeClient } from './stripe.js';
import { PaymentRepository } from '../db/payment-repository.js';

export class PaymentService {
  private stripe = new StripeClient();
  private repo = new PaymentRepository();

  createPayment(input: { amount: number }) {
    const charge = this.stripe.createPayment(input.amount);
    return this.repo.save(charge);
  }

  cancelInvoice(id: string) {
    this.stripe.refund(id);
    return this.repo.markCancelled(id);
  }
}
`,
  );
  write(
    root,
    'src/services/stripe.ts',
    `export class StripeClient {
  createPayment(amount: number) { return { id: 'ch_1', amount }; }
  refund(id: string) { return { id, refunded: true }; }
}
`,
  );
  write(
    root,
    'src/db/payment-repository.ts',
    `export class PaymentRepository {
  save(row: unknown) { return row; }
  markCancelled(id: string) { return { id, status: 'cancelled' }; }
}
`,
  );
  write(
    root,
    'src/db/client.ts',
    `export class DbClient {
  transaction<T>(fn: () => T): T { return fn(); }
}
`,
  );
  write(
    root,
    'src/middleware/auth.ts',
    `export function requireAuth(req: any, res: any, next: () => void) {
  if (!req.headers.authorization) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}
`,
  );
  write(
    root,
    'src/middleware/errors.ts',
    `export function toHttpError(err: Error) {
  return { status: 500, body: { message: err.message } };
}
`,
  );
  write(
    root,
    'src/auth/service.ts',
    `export class AuthService {
  login(email: string, password: string) { return { token: 't' }; }
  verify(token: string) { return Boolean(token); }
}
`,
  );
  write(
    root,
    'src/billing/invoice-service.ts',
    `import { PaymentService } from '../services/payment-service.js';
export class InvoiceService {
  private payments = new PaymentService();
  createInvoice() { return this.payments.createPayment({ amount: 10 }); }
}
`,
  );
  write(
    root,
    'src/workers/jobs.ts',
    `export function registerJobs(queue: { add: Function }) {
  queue.add('reconcile-payments', () => {});
}
`,
  );
  write(
    root,
    'src/config/env.ts',
    `export const config = { stripeKey: process.env.STRIPE_KEY ?? '' };
`,
  );
  write(
    root,
    'tests/payments/payment-service.test.ts',
    `import { PaymentService } from '../../src/services/payment-service.js';
test('createPayment', () => { expect(new PaymentService()).toBeTruthy(); });
`,
  );
  write(
    root,
    'tests/auth/auth.test.ts',
    `import { AuthService } from '../../src/auth/service.js';
test('login', () => { expect(new AuthService().login('a','b')).toBeTruthy(); });
`,
  );
}

const QUERIES = [
  { q: 'Add support for invoice cancellation.', expect: [/payment|invoice|cancel/i], wantRec: true, wantRule: true },
  { q: 'Fix the authentication bug.', expect: [/auth/i], soft: true },
  { q: 'Add a new payment endpoint.', expect: [/payment|route/i], wantRec: true },
  { q: 'Why is this API returning 403?', expect: [/auth|middleware|403|forbidden/i], soft: true },
  { q: 'Where should I put this validation?', expect: [/payment|middleware|route|service/i], soft: true },
  { q: 'How does authentication flow through this project?', expect: [/auth/i] },
  { q: 'What happens when an invoice is created?', expect: [/invoice|payment/i], soft: true },
  { q: 'What calls PaymentService?', expect: [/payment|invoice|route/i] },
  { q: 'Who depends on BillingService?', expect: [/billing|invoice|payment/i], soft: true },
  { q: 'What breaks if I change PaymentService?', expect: [/payment/i] },
  { q: 'Where is the database transaction boundary?', expect: [/db|transaction|client/i], soft: true },
  { q: 'Where should I modify database access?', expect: [/db|repository|payment-repository/i], soft: true },
  { q: 'Where are API errors converted into HTTP responses?', expect: [/error|middleware/i], soft: true },
  { q: 'Where should a new background job live?', expect: [/worker|job/i], soft: true },
  { q: 'How are background jobs registered?', expect: [/worker|job|register/i], soft: true },
  { q: 'Where are tests for billing?', expect: [/test|payment/i], soft: true },
  { q: 'What conventions should I follow when adding an endpoint?', expect: [/route|payment|rule|stripe/i], soft: true },
  { q: 'What rule applies to Stripe calls?', expect: [/stripe|rule/i], wantRule: true },
  { q: 'What architecture decision affects payments?', expect: [/payment|stripe|decision/i], soft: true },
  { q: 'Which files would I likely need to change for this feature?', expect: [/payment/i], soft: true },
  { q: 'What is the path from an API route to the database?', expect: [/payment|route|repository/i], soft: true },
  { q: 'Where should I start implementing this feature?', expect: [/payment|invoice/i], soft: true },
  // vague
  { q: 'fix payments', expect: [/payment/i], soft: true, wantRec: true },
  { q: 'add billing support', expect: [/billing|payment|invoice/i], soft: true, wantRec: true },
  { q: 'change auth', expect: [/auth/i], soft: true, wantRec: true },
  { q: 'refactor database access', expect: [/db|repository/i], soft: true, wantRec: true },
  { q: 'implement cancellation', expect: [/cancel|payment|invoice/i], soft: true, wantRec: true },
  { q: 'add webhook support', expect: [/payment|stripe|route/i], soft: true },
  // negatives
  { q: 'Where is Kubernetes deployment?', negative: true },
  { q: 'Where is Terraform?', negative: true },
  { q: 'Where is Kafka?', negative: true },
  { q: 'Where is GraphQL?', negative: true },
];

function grade(spec, body) {
  const blob = JSON.stringify(body).toLowerCase();
  const ctx = String(body.context ?? '');
  const rec = body.recommendation?.path ?? '';
  const empty =
    /no stored project knowledge|no matching/i.test(ctx) &&
    !rec &&
    !(body.relevantFiles?.length || body.relevantModules?.length);

  if (spec.negative) {
    if (empty || (!/src\//.test(blob) && !rec)) return 'CORRECT';
    if (/kubernetes|terraform|kafka|graphql/.test(rec)) return 'WRONG';
    // soft: returned something unrelated but not claiming those systems exist
    if (/src\//.test(blob) && !empty) return 'ACCEPTABLE';
    return 'CORRECT';
  }

  const hitExpect = (spec.expect ?? []).some((re) => re.test(ctx + rec + JSON.stringify(body.relevantFiles)));
  if (hitExpect && (!spec.wantRec || body.recommendation)) return 'CORRECT';
  if (hitExpect) return 'ACCEPTABLE';
  if (spec.soft && (body.relevantFiles?.length || body.recommendation || !empty)) return 'ACCEPTABLE';
  if (empty) return 'NO_MATCH';
  return 'WRONG';
}

async function withMcp(cwd, fn) {
  const transport = new StdioClientTransport({
    command: node,
    args: [bin, 'mcp'],
    env: { ...process.env, NEURON_CWD: cwd },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'daily-audit', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

async function ask(client, q) {
  const t0 = performance.now();
  const res = await client.callTool({ name: 'neuron_context', arguments: { task: q } });
  const text = res.content?.find((c) => c.type === 'text')?.text ?? '';
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { context: text };
  }
  return { body, ms: Math.round(performance.now() - t0) };
}

async function main() {
  spawnSync('pnpm', ['--filter', 'neuronai', 'build'], {
    cwd: repo,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  });

  const root = mkdtempSync(join(tmpdir(), 'neuron-daily-'));
  buildBackend(root);
  spawnSync(node, [bin, 'init', '--yes'], { cwd: root, encoding: 'utf8' });
  spawnSync(
    node,
    [
      bin,
      'remember',
      'Never call Stripe directly from route handlers. Always go through PaymentService.',
      '--yes',
      '--type',
      'business_rule',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  spawnSync(
    node,
    [
      bin,
      'remember',
      'Decision: Payments must go through PaymentService so refunds and persistence stay consistent.',
      '--yes',
      '--type',
      'architecture_decision',
    ],
    { cwd: root, encoding: 'utf8' },
  );

  const results = await withMcp(root, async (client) => {
    const out = [];
    for (const spec of QUERIES) {
      const { body, ms } = await ask(client, spec.q);
      const g = grade(spec, body);
      const row = {
        q: spec.q,
        grade: g,
        intent: body.intent,
        rec: body.recommendation?.path ?? null,
        symbol: body.recommendation?.symbol ?? null,
        flow: body.recommendation?.flow?.map((s) => s.label).join(' → ') ?? null,
        deps: body.recommendation?.dependencies?.length ?? 0,
        related: body.recommendation?.related?.length ?? 0,
        rules: body.relevantRules?.length ?? 0,
        tokens: body.metrics?.contextTokens ?? null,
        retrievalMs: body.metrics?.retrievalMs ?? ms,
        markdownHead: String(body.context ?? '')
          .split('\n')
          .slice(0, 18)
          .join('\n'),
      };
      out.push(row);
      console.log(
        `${g.padEnd(10)} intent=${String(body.intent).padEnd(16)} rec=${(row.rec ?? '-').slice(0, 40)}  ${spec.q.slice(0, 50)}`,
      );
    }
    return out;
  });

  const counts = { CORRECT: 0, ACCEPTABLE: 0, WRONG: 0, NO_MATCH: 0 };
  for (const r of results) counts[r.grade]++;
  const withRec = results.filter((r) => r.rec).length;
  const vague = results.filter((r) =>
    /^(fix payments|add billing|change auth|refactor database|implement cancellation)/i.test(r.q),
  );
  const negatives = results.filter((r) => /Kubernetes|Terraform|Kafka|GraphQL/i.test(r.q));

  const report = {
    generatedAt: new Date().toISOString(),
    LIVE_AGENT_PROOF: 'UNAVAILABLE',
    EXPLORATION_POLICY_PROOF: 'see real-agent-benchmark-report.json',
    counts,
    withRecommendation: withRec,
    vague: vague.map((v) => ({ q: v.q, grade: v.grade, intent: v.intent, rec: v.rec })),
    negatives: negatives.map((v) => ({ q: v.q, grade: v.grade })),
    avgRetrievalMs:
      results.reduce((s, r) => s + (r.retrievalMs || 0), 0) / Math.max(1, results.length),
    avgTokens: results.reduce((s, r) => s + (r.tokens || 0), 0) / Math.max(1, results.length),
    results,
  };

  writeFileSync(join(repo, 'daily-use-audit-report.json'), JSON.stringify(report, null, 2));
  console.log('\nCounts', counts);
  console.log('Vague intents:', report.vague);
  console.log('Wrote daily-use-audit-report.json');
  rmSync(root, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
