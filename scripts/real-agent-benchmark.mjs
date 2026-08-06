#!/usr/bin/env node
/**
 * P2 — Real agent effectiveness proof (scripted exploration policies).
 *
 * Compares:
 *   A) Baseline — blind rediscovery via directory listing + ripgrep + file reads
 *   B) NeuronAI — neuron_context first, then open returned paths
 *
 * IMPORTANT LABELS
 * - This is a SCRIPTTED coding-agent exploration harness, not a live Cursor/Claude
 *   session. Live agent tokens and wall-clock LLM latency are UNAVAILABLE without
 *   CURSOR_API_KEY / model credentials.
 * - Brain compression metrics come from neuron_context and are NOT "agent token savings".
 * - Exploration reduction is measured from observable tool-like operations only.
 *
 * Usage:
 *   node scripts/real-agent-benchmark.mjs
 *   node scripts/real-agent-benchmark.mjs --keep   # leave fixture dir
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const neuronBin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const keep = process.argv.includes('--keep');
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const MAX_BASELINE_OPS = 40;
const MAX_NEURON_FALLBACK_OPS = 12;

function write(root, rel, body) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function runCli(args, cwd) {
  const r = spawnSync(node, [neuronBin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`neuron ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

/** Realistic commerce fixture — noisy enough that blind discovery costs ops. */
function buildFixture(root) {
  write(
    root,
    'package.json',
    JSON.stringify(
      {
        name: 'acme-commerce',
        version: '4.1.0',
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
      'Storefront + billing.',
      '',
      '## Rules',
      '- Routes stay thin; business logic in services.',
      '- DB access only in repositories.',
      '- Never call Stripe from route handlers — use PaymentService / BillingService.',
      '- Auth uses AuthService + auth middleware.',
    ].join('\n'),
  );

  write(root, 'src/config/env.ts', `export const config = { db: process.env.DATABASE_URL };\n`);
  write(root, 'src/db/schema.ts', `export const invoices = { name: 'invoices' };\nexport const payments = { name: 'payments' };\n`);
  write(root, 'src/db/client.ts', `export class DatabaseClient { query(_s: string) { return []; } }\n`);

  write(root, 'src/auth/service.ts', `export class AuthService {\n  login() {}\n  verify() {}\n}\n`);
  write(root, 'src/auth/middleware.ts', `export function authMiddleware() { return (req: unknown) => req; }\n`);
  write(root, 'src/auth/jwt.ts', `export function signToken() { return 't'; }\n`);

  write(
    root,
    'src/billing/service.ts',
    `import { InvoiceRepository } from './invoices/repository.js';\nimport { PaymentService } from '../payments/service.js';\nexport class BillingService {\n  constructor(\n    private invoices = new InvoiceRepository(),\n    private payments = new PaymentService(),\n  ) {}\n  createInvoice(amount: number) { return this.invoices.save({ amount }); }\n  cancelInvoice(id: string) { return this.invoices.markCancelled(id); }\n}\n`,
  );
  write(
    root,
    'src/billing/routes.ts',
    `import { Router } from 'express';\nimport { BillingService } from './service.js';\nconst billing = new BillingService();\nexport const billingRouter = Router();\nbillingRouter.post('/billing/invoices', () => billing.createInvoice(10));\nbillingRouter.post('/billing/invoices/:id/cancel', (req: any) => billing.cancelInvoice(req.params.id));\n`,
  );
  write(root, 'src/billing/invoices/service.ts', `export class InvoiceService {\n  cancelInvoice(id: string) { return { id, status: 'cancelled' }; }\n  createInvoice() {}\n}\n`);
  write(root, 'src/billing/invoices/repository.ts', `export class InvoiceRepository {\n  save(row: object) { return row; }\n  markCancelled(id: string) { return { id, status: 'cancelled' }; }\n}\n`);
  write(root, 'src/billing/invoices/validation.ts', `export function validateInvoice(input: unknown) { return input; }\n`);

  write(
    root,
    'src/payments/service.ts',
    `import { StripeClient } from './stripe.js';\nexport class PaymentService {\n  private stripe = new StripeClient();\n  charge() { return this.stripe.charge(); }\n  createPaymentIntent() { return this.stripe.createPaymentIntent(); }\n}\n`,
  );
  write(root, 'src/payments/stripe.ts', `export class StripeClient {\n  charge() { return 'ok'; }\n  createPaymentIntent() { return { id: 'pi' }; }\n}\n`);
  write(root, 'src/payments/repository.ts', `export class PaymentRepository { record() {}\n}\n`);
  write(
    root,
    'src/payments/routes.ts',
    `import { Router } from 'express';\nimport { PaymentService } from './service.js';\nconst payments = new PaymentService();\nexport const paymentsRouter = Router();\npaymentsRouter.post('/payments', () => payments.createPaymentIntent());\n`,
  );

  write(root, 'src/api/routes/index.ts', `export { healthRouter } from './health.js';\nexport { usersRouter } from './users.js';\n`);
  write(root, 'src/api/routes/health.ts', `import { Router } from 'express';\nexport const healthRouter = Router();\nhealthRouter.get('/health', () => ({ ok: true }));\n`);
  write(root, 'src/api/routes/users.ts', `import { Router } from 'express';\nexport const usersRouter = Router();\nusersRouter.get('/api/users', () => []);\n`);
  write(root, 'src/api/server.ts', `import express from 'express';\nexport function createServer() { return express(); }\n`);

  write(root, 'src/workers/email-job.ts', `export async function sendEmailJob() {}\n`);
  write(root, 'src/workers/billing-job.ts', `export async function reconcileBillingJob() {}\n`);
  write(root, 'src/users/service.ts', `export class UserService { find() {}\n}\n`);
  write(root, 'src/users/repository.ts', `export class UserRepository { findById() {}\n}\n`);

  // Noise / similarly named / legacy / generated / UI
  write(root, 'src/billing-ui/Badge.tsx', `export function BillingBadge() { return null; }\n`);
  write(root, 'src/billing-admin/Dashboard.tsx', `export function BillingAdminDashboard() { return null; }\n`);
  write(root, 'src/legacy/old-payments.ts', `export function legacyCharge() {}\n`);
  write(root, 'src/generated/billing_pb.ts', `export const BillingProto = {};\n`);
  write(root, 'src/experimental/pay-v2.ts', `export function experimentalPay() {}\n`);
  write(root, 'docs/billing.md', `# Billing product notes\n`);
  write(root, 'docs/deploy.md', `# Deploy\nNo Kubernetes in this repo.\n`);

  write(root, 'tests/auth/AuthService.test.ts', `import { AuthService } from '../../src/auth/service.js';\ntest('auth', () => { new AuthService(); });\n`);
  write(root, 'tests/billing/invoices.test.ts', `import { InvoiceService } from '../../src/billing/invoices/service.js';\ntest('cancel', () => { new InvoiceService().cancelInvoice('1'); });\n`);
  write(root, 'tests/payments/PaymentService.test.ts', `import { PaymentService } from '../../src/payments/service.js';\ntest('pay', () => { new PaymentService(); });\n`);

  // Bulk noise files so tree/rg has more to chew
  for (let i = 0; i < 40; i++) {
    write(root, `src/generated/mod${i}.ts`, `export const g${i} = ${i};\n`);
  }
}

const TASKS = [
  {
    id: 'L1',
    category: 'location',
    task: 'Where is authentication implemented?',
    keywords: ['auth', 'AuthService', 'jwt', 'middleware'],
    gold: [/src\/auth\//],
    anti: [/billing-ui/, /kubernetes/i],
  },
  {
    id: 'L2',
    category: 'location',
    task: 'Where are API routes defined?',
    keywords: ['routes', 'Router', 'api'],
    gold: [/src\/api\/routes|src\/billing\/routes|src\/payments\/routes/],
    anti: [],
  },
  {
    id: 'L3',
    category: 'location',
    task: 'Where is Stripe integration?',
    keywords: ['Stripe', 'stripe', 'Payment'],
    gold: [/src\/payments\/stripe/],
    anti: [/billing-ui/],
  },
  {
    id: 'L4',
    category: 'location',
    task: 'Where are invoices handled?',
    keywords: ['invoice', 'Invoice', 'cancelInvoice'],
    gold: [/src\/billing\/invoices|src\/billing\/service/],
    anti: [/billing-ui/],
  },
  {
    id: 'L5',
    category: 'location',
    task: 'Where is database access?',
    keywords: ['Database', 'repository', 'schema', 'db'],
    gold: [/src\/db\/|repository/i],
    anti: [/billing-ui/],
  },
  {
    id: 'M1',
    category: 'modification',
    task: 'Add a new payment endpoint.',
    keywords: ['payment', 'payments', 'routes', 'endpoint'],
    gold: [/src\/payments\/routes|src\/payments\/service|src\/billing\/routes/],
    anti: [/billing-ui/, /generated/],
  },
  {
    id: 'M2',
    category: 'modification',
    task: 'Add invoice cancellation.',
    keywords: ['cancelInvoice', 'invoice', 'billing'],
    gold: [/src\/billing\/(service|invoices|routes)/],
    anti: [/billing-ui/],
  },
  {
    id: 'M3',
    category: 'modification',
    task: 'Add authentication middleware.',
    keywords: ['auth', 'middleware'],
    gold: [/src\/auth\/middleware/],
    anti: [/payments\/stripe/],
  },
  {
    id: 'M4',
    category: 'modification',
    task: 'Add a background job.',
    keywords: ['worker', 'job', 'jobs'],
    gold: [/src\/workers\//],
    anti: [],
  },
  {
    id: 'M5',
    category: 'modification',
    task: 'Modify database access.',
    keywords: ['repository', 'DatabaseClient', 'db'],
    gold: [/src\/db\/|repository/i],
    anti: [/billing-ui/],
  },
  {
    id: 'D1',
    category: 'dependency',
    task: 'What depends on BillingService?',
    keywords: ['BillingService', 'billing'],
    gold: [/src\/billing\/routes|src\/billing\/service/],
    anti: [],
  },
  {
    id: 'D2',
    category: 'dependency',
    task: 'What calls createInvoice?',
    keywords: ['createInvoice', 'BillingService'],
    gold: [/src\/billing\//],
    anti: [],
  },
  {
    id: 'D3',
    category: 'impact',
    task: 'What would be affected by changing the payment service?',
    keywords: ['PaymentService', 'payments', 'stripe'],
    gold: [/src\/payments\//],
    anti: [/kubernetes/i],
  },
  {
    id: 'D4',
    category: 'flow',
    task: 'What is the flow from API route to payment provider?',
    keywords: ['payments', 'Stripe', 'PaymentService', 'routes'],
    gold: [/src\/payments\//],
    anti: [],
  },
  {
    id: 'D5',
    category: 'impact',
    task: 'Which tests should change if invoice logic changes?',
    keywords: ['invoice', 'test', 'billing'],
    gold: [/tests\/billing/],
    anti: [],
  },
  {
    id: 'R1',
    category: 'rules',
    task: 'What rule applies when modifying payments?',
    keywords: ['Stripe', 'route', 'Payment'],
    gold: [/payments|billing|Stripe/i],
    anti: [],
    expectRule: /stripe|route/i,
  },
  {
    id: 'R2',
    category: 'rules',
    task: 'What conventions should be followed?',
    keywords: ['convention', 'service', 'repository'],
    gold: [/./],
    soft: true,
  },
  {
    id: 'R3',
    category: 'rules',
    task: 'What architectural decision affects billing?',
    keywords: ['billing', 'Stripe', 'service'],
    gold: [/billing|payment/i],
    soft: true,
  },
  {
    id: 'N1',
    category: 'negative',
    task: 'How does Kubernetes deployment work in this project?',
    keywords: ['Kubernetes', 'k8s', 'helm'],
    gold: [],
    negative: true,
  },
  {
    id: 'N2',
    category: 'negative',
    task: 'Where is the Terraform AWS Lambda defined?',
    keywords: ['Terraform', 'Lambda', 'AWS'],
    gold: [],
    negative: true,
  },
];

function isGold(path, gold) {
  if (!gold?.length) return false;
  const p = path.replace(/\\/g, '/');
  return gold.some((re) => re.test(p));
}

function listDir(root, rel = '') {
  const abs = join(root, rel);
  try {
    return readdirSync(abs)
      .filter((n) => !n.startsWith('.') && n !== 'node_modules')
      .map((n) => (rel ? `${rel}/${n}` : n).replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

function rgFiles(root, pattern) {
  const r = spawnSync(
    process.platform === 'win32' ? 'rg.exe' : 'rg',
    ['-l', '--glob', '!node_modules', '--glob', '!.neuron', pattern, '.'],
    { cwd: root, encoding: 'utf8' },
  );
  if (r.status !== 0 && r.status !== 1) return [];
  return (r.stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^\.\//, '').replace(/\\/g, '/'))
    .filter(Boolean);
}

function readRel(root, rel) {
  const abs = join(root, rel);
  if (!existsSync(abs) || !statSync(abs).isFile()) return null;
  return readFileSync(abs, 'utf8');
}

function record(ops, type, detail, path) {
  ops.push({
    n: ops.length + 1,
    type,
    detail,
    path: path ?? null,
    exploration: ['list_dir', 'rg', 'tree', 'find', 'blind_read'].includes(type),
  });
}

/**
 * Baseline policy: rediscover structure with list + rg + open hits.
 * Mirrors a typical coding agent without project memory.
 */
function runBaseline(root, task) {
  const ops = [];
  let firstUseful = null;
  const opened = [];

  record(ops, 'list_dir', 'list project root', '.');
  const top = listDir(root);
  if (top.includes('src')) {
    record(ops, 'list_dir', 'list src/', 'src');
    listDir(root, 'src');
  }

  for (const kw of task.keywords.slice(0, 4)) {
    if (ops.length >= MAX_BASELINE_OPS) break;
    record(ops, 'rg', `rg -l ${kw}`, null);
    const hits = rgFiles(root, kw).slice(0, 6);
    for (const hit of hits) {
      if (ops.length >= MAX_BASELINE_OPS) break;
      // Opening rg hits without prior knowledge counts as exploration until gold.
      const useful = isGold(hit, task.gold);
      record(ops, useful ? 'file_read' : 'blind_read', `open ${hit}`, hit);
      opened.push(hit);
      if (useful && firstUseful == null) firstUseful = ops.length;
      if (useful && task.category !== 'negative') {
        // Follow one more sibling list for realism
        const parent = dirname(hit).replace(/\\/g, '/');
        if (parent && parent !== '.') {
          record(ops, 'list_dir', `list ${parent}`, parent);
        }
        break;
      }
    }
    if (firstUseful != null && !task.negative) break;
  }

  // Extra directory wandering common in cold agents
  if (firstUseful == null && !task.negative && ops.length < MAX_BASELINE_OPS) {
    for (const dir of ['src/billing-ui', 'src/generated', 'docs', 'tests']) {
      if (ops.length >= MAX_BASELINE_OPS) break;
      if (!existsSync(join(root, dir))) continue;
      record(ops, 'list_dir', `list ${dir}`, dir);
    }
  }

  return summarizeRun('baseline', task, ops, opened, firstUseful, null);
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
  const client = new Client({ name: 'real-agent-bench', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function askContext(client, task) {
  const result = await client.callTool({ name: 'neuron_context', arguments: { task } });
  const text = result.content?.map((c) => c.text).join('\n') ?? '';
  const start = text.indexOf('{');
  return start >= 0 ? JSON.parse(text.slice(start)) : {};
}

/**
 * Neuron policy: context first, then open recommended/relevant paths.
 * Falls back to limited rg only if context is empty (negatives / misses).
 */
async function runNeuron(root, task, client) {
  const ops = [];
  let firstUseful = null;
  const opened = [];

  record(ops, 'neuron_context', `neuron_context: ${task.task}`, null);
  const body = await askContext(client, task.task);
  const brain = {
    contextTokens: body.metrics?.contextTokens ?? null,
    corpusTokens: body.metrics?.corpusTokens ?? null,
    compressionRatio: body.metrics?.compressionRatio ?? null,
    retrievalMs: body.metrics?.retrievalMs ?? null,
    estimatedTokensSaved: body.metrics?.estimatedTokensSaved ?? null,
    baseline: body.metrics?.baseline ?? 'whole-brain-verbatim',
    recommendation: body.recommendation ?? null,
    intent: body.intent ?? null,
  };

  const candidates = [];
  if (body.recommendation?.path) candidates.push(body.recommendation.path);
  for (const f of body.relevantFiles ?? []) {
    if (f.path) candidates.push(f.path);
  }
  for (const m of body.relevantModules ?? []) {
    if (m.path) candidates.push(m.path.replace(/\/$/, '/'));
  }

  const unique = [...new Set(candidates.map((p) => p.replace(/\\/g, '/')))];

  if (task.negative) {
    // Success = no confident project locations / no gold hallucination
    const hallucinated = unique.some((p) => /kubernetes|terraform|lambda/i.test(p));
    return summarizeRun('neuron', task, ops, opened, firstUseful, brain, {
      negativeOk: unique.length === 0 && !hallucinated,
      hallucinated,
    });
  }

  for (const path of unique.slice(0, 8)) {
    const filePath = path.endsWith('/')
      ? null
      : existsSync(join(root, path))
        ? path
        : null;
    if (path.endsWith('/')) {
      record(ops, 'list_dir', `list recommended ${path}`, path);
      continue;
    }
    if (!filePath) continue;
    const useful = isGold(filePath, task.gold);
    record(ops, useful ? 'file_read' : 'file_read', `open context path ${filePath}`, filePath);
    opened.push(filePath);
    if (useful && firstUseful == null) firstUseful = ops.length;
  }

  // Limited fallback rediscovery if Brain missed
  if (firstUseful == null) {
    for (const kw of task.keywords.slice(0, 2)) {
      if (ops.length >= 1 + MAX_NEURON_FALLBACK_OPS) break;
      record(ops, 'rg', `fallback rg -l ${kw}`, null);
      for (const hit of rgFiles(root, kw).slice(0, 3)) {
        record(ops, 'blind_read', `fallback open ${hit}`, hit);
        opened.push(hit);
        if (isGold(hit, task.gold) && firstUseful == null) firstUseful = ops.length;
        if (firstUseful != null) break;
      }
      if (firstUseful != null) break;
    }
  }

  return summarizeRun('neuron', task, ops, opened, firstUseful, brain);
}

function gradeStartingPoint(task, opened, recommendation, extra) {
  if (task.negative) {
    if (extra?.negativeOk) return 'CORRECT';
    if (extra?.hallucinated) return 'WRONG';
    return opened.length === 0 ? 'CORRECT' : 'ACCEPTABLE';
  }
  const rec = recommendation?.path?.replace(/\\/g, '/') ?? '';
  if (rec && isGold(rec, task.gold)) return 'CORRECT';
  if (opened.some((p) => isGold(p, task.gold))) {
    return rec && !isGold(rec, task.gold) ? 'ACCEPTABLE' : 'CORRECT';
  }
  if (task.soft && opened.length > 0) return 'ACCEPTABLE';
  return 'WRONG';
}

function gradeAnswer(task, opened, bodyExtra, starting) {
  if (task.negative) {
    return starting === 'WRONG' ? 'incorrect' : 'correct';
  }
  if (starting === 'CORRECT') return 'correct';
  if (starting === 'ACCEPTABLE') return 'partially correct';
  if (opened.some((p) => isGold(p, task.gold))) return 'partially correct';
  return 'incorrect';
}

function summarizeRun(arm, task, ops, opened, firstUseful, brain, extra = {}) {
  const explorationOps = ops.filter((o) => o.exploration);
  const fileReads = ops.filter((o) => o.type === 'file_read' || o.type === 'blind_read');
  const blindReads = ops.filter((o) => o.type === 'blind_read');
  const dirs = ops.filter((o) => o.type === 'list_dir');
  const startingPoint = gradeStartingPoint(task, opened, brain?.recommendation, extra);
  const answer = gradeAnswer(task, opened, extra, startingPoint);

  return {
    arm,
    taskId: task.id,
    task: task.task,
    category: task.category,
    tool_calls: ops.length,
    exploration_calls: explorationOps.length,
    file_reads: fileReads.length,
    blind_file_reads: blindReads.length,
    directories_explored: dirs.length,
    tokens_if_available: null,
    time_if_available: brain?.retrievalMs ?? null,
    first_useful_file_op: firstUseful,
    opened,
    recommendation: brain?.recommendation?.path ?? null,
    starting_point: startingPoint,
    correctness: answer,
    unnecessary_exploration: explorationOps.length,
    rediscovery_calls: explorationOps.filter((o) => firstUseful == null || o.n < firstUseful).length,
    ops,
    brain_compression: brain
      ? {
          contextTokens: brain.contextTokens,
          corpusTokens: brain.corpusTokens,
          compressionRatio: brain.compressionRatio,
          estimatedTokensSaved: brain.estimatedTokensSaved,
          baseline: brain.baseline,
          label: 'Brain compression — not measured agent token savings',
        }
      : null,
  };
}

function aggregate(rows) {
  const n = rows.length || 1;
  const avg = (key) => Math.round((rows.reduce((s, r) => s + (r[key] ?? 0), 0) / n) * 10) / 10;
  const correct = rows.filter((r) => r.correctness === 'correct').length;
  const partial = rows.filter((r) => r.correctness === 'partially correct').length;
  const wrongStart = rows.filter((r) => r.starting_point === 'WRONG').length;
  return {
    tasks: rows.length,
    avg_tool_calls: avg('tool_calls'),
    avg_exploration_calls: avg('exploration_calls'),
    avg_file_reads: avg('file_reads'),
    avg_blind_file_reads: avg('blind_file_reads'),
    avg_directories_explored: avg('directories_explored'),
    avg_first_useful_file_op: avg('first_useful_file_op'),
    correct,
    partially_correct: partial,
    incorrect: rows.filter((r) => r.correctness === 'incorrect').length,
    wrong_starting_point: wrongStart,
    starting_correct: rows.filter((r) => r.starting_point === 'CORRECT').length,
    starting_acceptable: rows.filter((r) => r.starting_point === 'ACCEPTABLE').length,
  };
}

function verdictFrom(comparison, mode) {
  if (mode !== 'scripted_exploration_policy') {
    return { product_impact: 'UNPROVEN', why: 'No comparable agent runs.' };
  }
  const red = comparison.exploration_reduction_pct;
  const startOk =
    comparison.neuron.starting_correct + comparison.neuron.starting_acceptable;
  const startRate = startOk / Math.max(1, comparison.neuron.tasks);
  const correctRate =
    (comparison.neuron.correct + comparison.neuron.partially_correct * 0.5) /
    Math.max(1, comparison.neuron.tasks);

  if (red >= 50 && startRate >= 0.8 && correctRate >= 0.8) {
    return {
      product_impact: 'STRONG',
      why: `Scripted policy shows ${red}% fewer exploration ops and ${Math.round(startRate * 100)}% acceptable/correct starting points. Live LLM agent traces were not run (no API key).`,
    };
  }
  if (red >= 25 && startRate >= 0.65) {
    return {
      product_impact: 'MODERATE',
      why: `Measurable rediscovery reduction (${red}%) under scripted exploration policy, with mostly useful starts. Not validated on live Cursor/Claude agents.`,
    };
  }
  if (red > 0) {
    return {
      product_impact: 'WEAK',
      why: `Only ${red}% exploration reduction or weak starting-point accuracy under the scripted policy.`,
    };
  }
  return {
    product_impact: 'UNPROVEN',
    why: 'No measured exploration reduction, or Neuron arm did not beat baseline.',
  };
}

// --- main ---
console.log('Building fixture + Project Brain…');
const root = mkdtempSync(join(tmpdir(), 'neuron-agent-bench-'));
buildFixture(root);
runCli(['init', '--yes'], root);
runCli(
  [
    'remember',
    'Never call Stripe directly from route handlers. Payment provider calls belong in PaymentService / BillingService.',
    '--yes',
    '--type',
    'business_rule',
  ],
  root,
);
runCli(
  [
    'remember',
    'Database access must stay inside repositories.',
    '--yes',
    '--type',
    'business_rule',
  ],
  root,
);

const liveAgent =
  process.env.CURSOR_API_KEY || process.env.ANTHROPIC_API_KEY
    ? 'credentials_present_but_live_harness_not_enabled'
    : 'unavailable_no_api_key';

const pairs = [];
await withMcp(root, async (client) => {
  for (const task of TASKS) {
    process.stdout.write(`  ${task.id}… `);
    const baseline = runBaseline(root, task);
    const neuron = await runNeuron(root, task, client);
    pairs.push({ task: task.task, category: task.category, baseline, neuron });
    console.log(
      `base_explore=${baseline.exploration_calls} neuron_explore=${neuron.exploration_calls} start=${neuron.starting_point}`,
    );
  }
});

const baselineAgg = aggregate(pairs.map((p) => p.baseline));
const neuronAgg = aggregate(pairs.map((p) => p.neuron));

const explorationReductionPct =
  baselineAgg.avg_exploration_calls === 0
    ? 0
    : Math.round(
        (1000 * (baselineAgg.avg_exploration_calls - neuronAgg.avg_exploration_calls)) /
          baselineAgg.avg_exploration_calls,
      ) / 10;

const fileReadReductionPct =
  baselineAgg.avg_file_reads === 0
    ? 0
    : Math.round(
        (1000 * (baselineAgg.avg_file_reads - neuronAgg.avg_file_reads)) /
          baselineAgg.avg_file_reads,
      ) / 10;

const firstUsefulImprovement =
  baselineAgg.avg_first_useful_file_op && neuronAgg.avg_first_useful_file_op
    ? Math.round((baselineAgg.avg_first_useful_file_op - neuronAgg.avg_first_useful_file_op) * 10) /
      10
    : null;

const comparison = {
  baseline: baselineAgg,
  neuron: neuronAgg,
  exploration_reduction_pct: explorationReductionPct,
  file_read_reduction_pct: fileReadReductionPct,
  first_useful_op_delta: firstUsefulImprovement,
};

const brainSamples = pairs
  .map((p) => p.neuron.brain_compression)
  .filter(Boolean);
const avgBrain = brainSamples.length
  ? {
      avg_context_tokens: Math.round(
        brainSamples.reduce((s, b) => s + (b.contextTokens ?? 0), 0) / brainSamples.length,
      ),
      avg_corpus_tokens: Math.round(
        brainSamples.reduce((s, b) => s + (b.corpusTokens ?? 0), 0) / brainSamples.length,
      ),
      avg_compression_ratio:
        Math.round(
          (brainSamples.reduce((s, b) => s + (b.compressionRatio ?? 0), 0) / brainSamples.length) *
            100,
        ) / 100,
      label: 'Brain compression — not measured agent token savings',
    }
  : null;

const failures = pairs.filter(
  (p) =>
    p.neuron.correctness === 'incorrect' ||
    p.neuron.starting_point === 'WRONG' ||
    (p.baseline.correctness === 'correct' && p.neuron.correctness === 'incorrect'),
);

const verdict = verdictFrom(comparison, 'scripted_exploration_policy');

const report = {
  generatedAt: new Date().toISOString(),
  methodology: {
    type: 'scripted_exploration_policy',
    description:
      'Baseline arm rediscovers the repo with list_dir + ripgrep + file opens. Neuron arm calls neuron_context first, then opens returned paths, with limited rg fallback only on miss. Not a live multi-turn LLM coding agent.',
    primary_question:
      'Does Project Brain measurably reduce the work an AI coding agent has to perform to understand an unfamiliar codebase?',
    live_agent_traces: liveAgent,
    agent_tokens: 'UNAVAILABLE',
    agent_llm_latency: 'UNAVAILABLE',
  },
  environment: {
    node: process.version,
    platform: process.platform,
    neuronBin,
    fixtureRoot: keep ? root : '(deleted)',
    apiKeys: {
      CURSOR_API_KEY: Boolean(process.env.CURSOR_API_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  },
  tasks: TASKS.map((t) => ({ id: t.id, category: t.category, task: t.task })),
  results: pairs.map((p) => ({
    task: p.task,
    category: p.category,
    baseline: {
      tool_calls: p.baseline.tool_calls,
      exploration_calls: p.baseline.exploration_calls,
      file_reads: p.baseline.file_reads,
      directories_explored: p.baseline.directories_explored,
      first_useful_file_op: p.baseline.first_useful_file_op,
      starting_point: p.baseline.starting_point,
      correctness: p.baseline.correctness,
      tokens_if_available: null,
      time_if_available: null,
    },
    neuron: {
      tool_calls: p.neuron.tool_calls,
      exploration_calls: p.neuron.exploration_calls,
      file_reads: p.neuron.file_reads,
      directories_explored: p.neuron.directories_explored,
      first_useful_file_op: p.neuron.first_useful_file_op,
      starting_point: p.neuron.starting_point,
      correctness: p.neuron.correctness,
      recommendation: p.neuron.recommendation,
      brain_compression: p.neuron.brain_compression,
      tokens_if_available: null,
      time_if_available: p.neuron.time_if_available,
    },
  })),
  aggregates: comparison,
  rediscovery_reduction: {
    baseline_avg_exploration_ops: baselineAgg.avg_exploration_calls,
    neuron_avg_exploration_ops: neuronAgg.avg_exploration_calls,
    reduction_pct: explorationReductionPct,
    measured: true,
    note: 'Counts list_dir, rg, and blind_read operations only.',
  },
  time_to_first_useful_file: {
    unit: 'operations_until_first_gold_path_open',
    baseline_avg_op: baselineAgg.avg_first_useful_file_op,
    neuron_avg_op: neuronAgg.avg_first_useful_file_op,
    improvement_ops: firstUsefulImprovement,
    wall_clock: 'UNAVAILABLE',
  },
  correctness: {
    neuron: {
      correct: neuronAgg.correct,
      partially_correct: neuronAgg.partially_correct,
      incorrect: neuronAgg.incorrect,
      starting_CORRECT: neuronAgg.starting_correct,
      starting_ACCEPTABLE: neuronAgg.starting_acceptable,
      starting_WRONG: neuronAgg.wrong_starting_point,
    },
    baseline: {
      correct: baselineAgg.correct,
      partially_correct: baselineAgg.partially_correct,
      incorrect: baselineAgg.incorrect,
    },
  },
  file_read_reduction: {
    baseline_avg: baselineAgg.avg_file_reads,
    neuron_avg: neuronAgg.avg_file_reads,
    reduction_pct: fileReadReductionPct,
  },
  token_measurements: {
    agent_tokens: 'UNAVAILABLE',
    brain_compression: avgBrain,
  },
  failures: failures.map((f) => ({
    task: f.task,
    neuron_start: f.neuron.starting_point,
    neuron_correctness: f.neuron.correctness,
    recommendation: f.neuron.recommendation,
  })),
  limitations: [
    'Not a live Cursor/Claude coding-agent run — no model tool traces.',
    'Baseline policy is a scripted rediscovery heuristic (list+rg+open), not an LLM.',
    'Agent session tokens and LLM wall-clock latency are UNAVAILABLE without API credentials + live harness.',
    'Brain compression must not be reported as agent token savings.',
    'Fixture is synthetic but structurally realistic; results may differ on arbitrary private monorepos.',
  ],
  reproducibility: {
    command: 'node scripts/real-agent-benchmark.mjs',
    requires: ['built neuronai CLI (pnpm --filter neuronai build)', 'ripgrep (rg) on PATH'],
    live_agent: 'Set CURSOR_API_KEY and extend harness — currently not enabled.',
  },
  product_impact: verdict.product_impact,
  product_impact_why: verdict.why,
  final_verdict: verdict.product_impact,
};

const outJson = join(repo, 'real-agent-benchmark-report.json');
writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nWrote ${outJson}`);
console.log(
  `Exploration: baseline ${baselineAgg.avg_exploration_calls} → neuron ${neuronAgg.avg_exploration_calls} (−${explorationReductionPct}%)`,
);
console.log(`First useful file op: ${baselineAgg.avg_first_useful_file_op} → ${neuronAgg.avg_first_useful_file_op}`);
console.log(`PRODUCT IMPACT: ${verdict.product_impact}`);

if (!keep) rmSync(root, { recursive: true, force: true });
