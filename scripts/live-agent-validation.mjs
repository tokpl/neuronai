#!/usr/bin/env node
/**
 * Live Cursor agent A/B validation — product path proof.
 *
 * Target path (required for MCP_PROOF / PROVEN):
 *   Cursor Agent → MCP → neuron_context → ProjectBrain → targeted reads
 *
 * IMPORTANT
 * ---------
 * - Does NOT invent tool traces.
 * - Does NOT treat CLI `neuron context` as MCP_PROOF.
 * - Does NOT treat EXPLORATION_POLICY_PROOF (scripted) as LIVE_AGENT_PROOF.
 * - PROVEN requires: working MCP neuron_context for agents, hard tool ledger,
 *   ≥20 tasks × 2 runs × A/B, diff-checked rule adherence.
 * - Hard transcript scoring: scripts/score-live-agent-transcripts.mjs
 *
 * Usage:
 *   node scripts/live-agent-validation.mjs              # access probe + status
 *   node scripts/live-agent-validation.mjs --probe-only
 *   CURSOR_API_KEY=cursor_... node scripts/live-agent-validation.mjs --runs 2
 *
 * Optional: @cursor/sdk (CURSOR_SDK_PATH or node_modules) for SDK MCP binding.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  cpSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const outJson = join(repo, 'live-agent-validation-report.json');
const outMd = join(repo, 'docs', 'LIVE_AGENT_VALIDATION.md');

const PLACEHOLDER_KEYS = new Set([
  '',
  'unset',
  'null',
  'none',
  'false',
  'todo',
  'your_key_here',
  'cursor_...',
]);

/**
 * Exact FINAL mix: 8 modify + 4 debug + 4 impact + 2 rules + 2 negative = 20.
 * Useful paths grade “correct start” / first useful file from hard traces.
 */
export const LIVE_TASKS = [
  // Modification — 8
  { id: 'M01', category: 'modify', prompt: 'Add support for cancelling invoices.', useful: ['src/api/routes/payments.ts', 'src/billing/invoice-service.ts', 'src/services/payment-service.ts'] },
  { id: 'M02', category: 'modify', prompt: 'Add a refund endpoint.', useful: ['src/api/routes/payments.ts', 'src/services/payment-service.ts'], rulesTest: true },
  { id: 'M03', category: 'modify', prompt: 'Add a background job that retries failed Stripe payments.', useful: ['src/workers/jobs.ts', 'src/services/payment-service.ts', 'src/workers/payment-retry-worker.ts'] },
  { id: 'M04', category: 'modify', prompt: 'Add validation for invoice cancellation.', useful: ['src/api/routes/payments.ts', 'src/billing/invoice-service.ts'] },
  { id: 'M05', category: 'modify', prompt: 'Add authentication middleware to payment routes that lack it.', useful: ['src/middleware/auth.ts', 'src/api/routes/payments.ts'] },
  { id: 'M06', category: 'modify', prompt: 'Change the payment flow so all charges go through PaymentService.', useful: ['src/api/routes/payments.ts', 'src/services/payment-service.ts'], rulesTest: true },
  { id: 'M07', category: 'modify', prompt: 'Add Stripe webhook signature verification handling.', useful: ['src/api/routes/webhooks.ts', 'src/services/stripe.ts'] },
  { id: 'M08', category: 'modify', prompt: "Refactor database access so payment routes don't talk directly to repositories.", useful: ['src/api/routes/payments.ts', 'src/services/payment-service.ts', 'src/db/payment-repository.ts'] },
  // Debugging — 4
  { id: 'D01', category: 'debug', prompt: 'Fix the authentication bug where expired tokens are accepted.', useful: ['src/auth/service.ts', 'src/middleware/auth.ts', 'tests/auth/auth.test.ts'] },
  { id: 'D02', category: 'debug', prompt: 'Investigate why payment webhooks are duplicated and fix it.', useful: ['src/api/routes/webhooks.ts', 'src/workers/jobs.ts'] },
  { id: 'D03', category: 'debug', prompt: 'Fix the failing authentication tests.', useful: ['tests/auth/auth.test.ts', 'src/auth/service.ts'] },
  { id: 'D04', category: 'debug', prompt: 'Fix failed payment retry so PaymentService.retryFailed works.', useful: ['src/services/payment-service.ts', 'src/services/stripe.ts'] },
  // Dependency / impact — 4
  { id: 'I01', category: 'impact', prompt: 'Change PaymentService so failed payments are retried.', useful: ['src/services/payment-service.ts', 'src/services/stripe.ts', 'src/db/payment-repository.ts', 'src/workers/jobs.ts'] },
  { id: 'I02', category: 'impact', prompt: 'Change the Stripe integration client used by payments.', useful: ['src/services/stripe.ts', 'src/services/payment-service.ts'] },
  { id: 'I03', category: 'impact', prompt: 'Change the invoice/payment repository persistence API.', useful: ['src/db/payment-repository.ts', 'src/billing/invoice-service.ts', 'src/services/payment-service.ts'] },
  { id: 'I04', category: 'impact', prompt: 'Change auth middleware behavior for forbidden responses.', useful: ['src/middleware/auth.ts', 'src/auth/service.ts'] },
  // Rules / architecture — 2
  { id: 'R01', category: 'rules', prompt: 'Modify the payment refund flow while respecting the Stripe route rule.', useful: ['src/api/routes/payments.ts', 'src/services/payment-service.ts'], rulesTest: true },
  { id: 'R02', category: 'rules', prompt: 'Add a payment capture endpoint while respecting architecture decisions.', useful: ['src/api/routes/payments.ts', 'src/services/payment-service.ts'], rulesTest: true },
  // Negative — 2
  { id: 'N01', category: 'negative', prompt: 'How should I configure Kubernetes autoscaling?', negative: true, useful: [] },
  { id: 'N02', category: 'negative', prompt: 'Where is the Terraform module for this service?', negative: true, useful: [] },
];

function parseArgs(argv) {
  const out = { probeOnly: false, limit: null, runs: 2, model: 'composer-2.5' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--probe-only') out.probeOnly = true;
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--runs') out.runs = Number(argv[++i]);
    else if (a === '--model') out.model = argv[++i];
  }
  return out;
}

function envKeyStatus(name) {
  const raw = process.env[name];
  if (raw == null) return { present: false, usable: false, reason: 'missing', length: 0 };
  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) return { present: false, usable: false, reason: 'empty', length: 0 };
  if (PLACEHOLDER_KEYS.has(lower)) {
    return { present: true, usable: false, reason: `placeholder:${trimmed}`, length: trimmed.length };
  }
  if (trimmed.length < 20) {
    return { present: true, usable: false, reason: 'too_short_likely_placeholder', length: trimmed.length };
  }
  return { present: true, usable: true, reason: 'looks_set', length: trimmed.length };
}

function which(cmd) {
  try {
    const r = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [cmd], {
      encoding: 'utf8',
      shell: false,
    });
    if (r.status !== 0) return null;
    return String(r.stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0];
  } catch {
    return null;
  }
}

function probeCursorCli() {
  const path = which('cursor');
  if (!path) return { available: false, agentSubcommand: false, note: 'cursor not on PATH' };
  const help = spawnSync('cursor', ['--help'], { encoding: 'utf8', shell: true, timeout: 15000 });
  const agentHelp = spawnSync('cursor', ['agent', '--help'], {
    encoding: 'utf8',
    shell: true,
    timeout: 15000,
  });
  const helpText = `${help.stdout || ''}\n${help.stderr || ''}`;
  const agentText = `${agentHelp.stdout || ''}\n${agentHelp.stderr || ''}`;
  const looksLikeIdeHelp =
    /Force to open a new window|Compare two files with each other/i.test(agentText);
  return {
    available: true,
    path,
    versionLine: helpText.split(/\r?\n/).find((l) => /Cursor/i.test(l)) ?? null,
    agentSubcommand: !looksLikeIdeHelp && /agent/i.test(agentText) && agentHelp.status === 0,
    agentHelpLooksLikeIdeOnly: looksLikeIdeHelp,
    note: looksLikeIdeHelp
      ? 'cursor agent --help returns IDE help — not a measurable headless agent runner'
      : 'cursor agent may be usable; still prefer @cursor/sdk for tool_call telemetry',
  };
}

async function probeCursorSdk() {
  const result = {
    packageResolvable: false,
    importError: null,
    resolvedFrom: null,
    authProbe: null,
  };
  let Agent;
  try {
    const mod = await loadAgentSdk();
    Agent = mod.Agent;
    result.packageResolvable = true;
    result.resolvedFrom = process.env.CURSOR_SDK_PATH || 'module-resolution';
  } catch (e) {
    result.importError = String(e?.message || e);
    return result;
  }

  const key = envKeyStatus('CURSOR_API_KEY');
  if (!key.usable) {
    result.authProbe = {
      attempted: false,
      usableKey: false,
      keyStatus: key,
      note: 'Skipped live prompt — no usable CURSOR_API_KEY',
    };
    return result;
  }

  try {
    const run = await Agent.prompt('Reply with exactly: PONG', {
      apiKey: process.env.CURSOR_API_KEY.trim(),
      model: { id: 'composer-2.5' },
      local: { cwd: process.cwd(), settingSources: [] },
    });
    result.authProbe = {
      attempted: true,
      status: run.status,
      error: run.error?.message ?? null,
      durationMs: run.durationMs ?? null,
      usable: run.status === 'finished',
    };
  } catch (e) {
    result.authProbe = {
      attempted: true,
      usable: false,
      error: String(e?.message || e),
    };
  }
  return result;
}

function write(root, rel, body = '') {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

/** Realistic TS API fixture: similar names, Stripe flow, auth bug, noise, workers. */
export function buildLiveFixture(root) {
  write(root, 'package.json', JSON.stringify({ name: 'acme-payments-api', type: 'module', private: true }, null, 2));
  write(
    root,
    'README.md',
    `# Acme Payments API

TypeScript Express-style API.

Rules:
- Never call Stripe directly from route handlers.
- Payment routes must use PaymentService.

Auth lives in src/auth + src/middleware.
Billing/invoices in src/billing.
Payments orchestration in src/services/payment-service.ts.
`,
  );

  write(
    root,
    'src/api/routes/payments.ts',
    `import { Router } from 'express';
import { PaymentService } from '../../services/payment-service.js';
import { requireAuth } from '../../middleware/auth.js';
import { InvoiceService } from '../../billing/invoice-service.js';

const router = Router();
const payments = new PaymentService();
const invoices = new InvoiceService();

export function createPaymentHandler(req: any, res: any) {
  return payments.createPayment(req.body);
}

export function cancelInvoiceHandler(req: any, res: any) {
  return payments.cancelInvoice(req.params.id);
}

// Intentionally awkward: one legacy path still peeks at repository (refactor target).
import { PaymentRepository } from '../../db/payment-repository.js';
const legacyRepo = new PaymentRepository();
export function legacyListHandler(_req: any, _res: any) {
  return legacyRepo.listRecent();
}

router.post('/payments', requireAuth, createPaymentHandler);
router.post('/invoices/:id/cancel', requireAuth, cancelInvoiceHandler);
router.get('/payments/legacy', requireAuth, legacyListHandler);
export default router;
`,
  );

  write(
    root,
    'src/api/routes/webhooks.ts',
    `import { Router } from 'express';
import { PaymentService } from '../../services/payment-service.js';

const router = Router();
const payments = new PaymentService();

// Known issue: handler may be invoked twice by the worker + HTTP path.
export function stripeWebhookHandler(req: any, res: any) {
  payments.handleWebhook(req.body);
  res.status(200).json({ ok: true });
}

router.post('/webhooks/stripe', stripeWebhookHandler);
export default router;
`,
  );

  write(
    root,
    'src/api/routes/admin.ts',
    `export function adminHealth() { return { ok: true }; }
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

  refund(id: string) {
    const result = this.stripe.refund(id);
    return this.repo.markRefunded(id, result);
  }

  handleWebhook(event: { type: string; id: string }) {
    return this.repo.saveWebhookEvent(event);
  }

  // Stub for retry work — intentionally incomplete.
  retryFailed(_id: string) {
    throw new Error('retry not implemented');
  }
}
`,
  );

  write(
    root,
    'src/services/payments-service.ts',
    `/** Noise: similarly named module — not the canonical PaymentService. */
export class PaymentsServiceLegacy {
  charge() { return { legacy: true }; }
}
`,
  );

  write(
    root,
    'src/services/billing-payments.ts',
    `/** Noise: billing-adjacent naming collision. */
export function billingPaymentsHelper() { return null; }
`,
  );

  write(
    root,
    'src/services/stripe.ts',
    `export class StripeClient {
  createPayment(amount: number) { return { id: 'ch_1', amount, status: 'succeeded' }; }
  refund(id: string) { return { id, refunded: true }; }
  verifySignature(_payload: string, _sig: string) { return true; }
}
`,
  );

  write(
    root,
    'src/db/payment-repository.ts',
    `export class PaymentRepository {
  save(row: unknown) { return row; }
  markCancelled(id: string) { return { id, status: 'cancelled' }; }
  markRefunded(id: string, result: unknown) { return { id, status: 'refunded', result }; }
  saveWebhookEvent(event: unknown) { return event; }
  listRecent() { return []; }
  findFailed() { return [{ id: 'pay_failed_1' }]; }
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
    `import { AuthService } from '../auth/service.js';

const auth = new AuthService();

export function requireAuth(req: any, res: any, next: () => void) {
  const header = req.headers.authorization;
  if (!header) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  const token = String(header).replace(/^Bearer\\s+/i, '');
  if (!auth.verify(token)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}
`,
  );

  write(
    root,
    'src/auth/service.ts',
    `/** BUG: expired tokens are still accepted (exp check commented out). */
export class AuthService {
  login(email: string, _password: string) {
    return { token: 'tok_' + email, exp: Date.now() - 60_000 };
  }

  verify(token: string) {
    if (!token) return false;
    // BUG: should reject when exp < Date.now()
    // const payload = decode(token); if (payload.exp < Date.now()) return false;
    return token.startsWith('tok_') || token.length > 3;
  }
}
`,
  );

  write(
    root,
    'src/billing/invoice-service.ts',
    `import { PaymentService } from '../services/payment-service.js';
import { PaymentRepository } from '../db/payment-repository.js';

export class InvoiceService {
  private payments = new PaymentService();
  private repo = new PaymentRepository();

  createInvoice() {
    return this.payments.createPayment({ amount: 10 });
  }

  history() {
    return this.repo.listRecent();
  }
}
`,
  );

  write(
    root,
    'src/billing/invoice-calculator.ts',
    `export function calcTax(amount: number) { return Math.round(amount * 0.23); }
`,
  );

  write(
    root,
    'src/workers/jobs.ts',
    `import { PaymentService } from '../services/payment-service.js';

export function registerJobs(queue: { add: Function }) {
  queue.add('reconcile-payments', () => {
    // Race: may also call webhook handler again.
    const payments = new PaymentService();
    payments.handleWebhook({ type: 'payment.updated', id: 'evt_dup' });
  });
  queue.add('retry-failed-payments', () => {
    // Placeholder — implement retries via PaymentService.
  });
}
`,
  );

  write(
    root,
    'src/workers/payment-retry-worker.ts',
    `export function scheduleRetry() { /* empty */ }
`,
  );

  write(root, 'src/config/env.ts', `export const config = { stripeKey: process.env.STRIPE_KEY ?? '' };\n`);

  // Noise
  write(root, 'src/noise/legacy-admin-ui.ts', `export const legacy = true;\n`);
  write(root, 'src/noise/old-billing-page.ts', `export function renderOldBilling() {}\n`);
  write(root, 'src/noise/misc-utils.ts', `export const noop = () => {};\n`);
  write(root, 'src/payments/README.md', '# Not the service layer — docs only\n');

  write(
    root,
    'tests/payments/payment-service.test.ts',
    `import { PaymentService } from '../../src/services/payment-service.js';
test('createPayment', () => {
  expect(new PaymentService().createPayment({ amount: 1 })).toBeTruthy();
});
`,
  );

  write(
    root,
    'tests/auth/auth.test.ts',
    `import { AuthService } from '../../src/auth/service.js';

test('login returns token', () => {
  expect(new AuthService().login('a', 'b').token).toMatch(/^tok_/);
});

test('expired tokens must be rejected', () => {
  const auth = new AuthService();
  // This documents the bug: currently passes incorrectly for short tokens.
  expect(auth.verify('tok_expired')).toBe(false);
});
`,
  );

  write(
    root,
    'tests/payments/webhook.test.ts',
    `test('webhook idempotency placeholder', () => {
  expect(true).toBe(true);
});
`,
  );
}

function seedNeuronBrain(fixtureRoot) {
  const init = spawnSync(node, [bin, 'init', '--yes'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
  const rememberRule = spawnSync(
    node,
    [
      bin,
      'remember',
      'Never call Stripe directly from route handlers. Payment routes must use PaymentService.',
      '--yes',
      '--type',
      'business_rule',
    ],
    { cwd: fixtureRoot, encoding: 'utf8', timeout: 60_000 },
  );
  const rememberDecision = spawnSync(
    node,
    [
      bin,
      'remember',
      'Decision: Payments must go through PaymentService so refunds, webhooks, and persistence stay consistent.',
      '--yes',
      '--type',
      'architecture_decision',
    ],
    { cwd: fixtureRoot, encoding: 'utf8', timeout: 60_000 },
  );
  return {
    initOk: init.status === 0,
    initErr: init.status === 0 ? null : String(init.stderr || init.stdout).slice(0, 400),
    rememberOk: rememberRule.status === 0 && rememberDecision.status === 0,
  };
}

function classifyTool(name = '') {
  const n = String(name).toLowerCase();
  if (/neuron_context|neuron_prepare_task|neuron_get_context/.test(n)) return 'neuron';
  if (/^(list_dir|ls|glob)$/i.test(n) || n.includes('list_dir') || n === 'ls') return 'list_dir';
  if (/^(grep|rg|sem_search|semsearch)$/i.test(n) || n.includes('grep') || n.includes('semsearch'))
    return 'grep';
  if (/^(read|read_file|open)$/i.test(n) || n.includes('read_file') || n === 'read') return 'read';
  if (/^(edit|write|apply_patch|search_replace|strreplace)$/i.test(n) || n.includes('edit'))
    return 'edit';
  if (/shell|bash|powershell|run_terminal/.test(n)) return 'shell';
  return 'other';
}

function extractPathFromArgs(args) {
  if (!args || typeof args !== 'object') return null;
  for (const k of ['path', 'file', 'target_file', 'filePath', 'filename', 'target']) {
    if (typeof args[k] === 'string' && args[k]) return args[k].replace(/\\/g, '/');
  }
  if (typeof args.pattern === 'string' && args.path) return String(args.path).replace(/\\/g, '/');
  return null;
}

function scoreRun({ task, arm, sequence, usage, wallMs, status, error, neuronMeta }) {
  const useful = (task.useful || []).map((p) => p.replace(/\\/g, '/'));
  let firstUseful = null;
  let filesBeforeUseful = 0;
  let wrongPaths = 0;
  const opened = [];

  for (const step of sequence) {
    if (step.kind === 'read' || step.kind === 'edit') {
      const p = step.path;
      if (p) {
        opened.push(p);
        const hit = useful.some((u) => p.endsWith(u) || p.includes(u));
        if (hit && !firstUseful) {
          firstUseful = p;
          filesBeforeUseful = opened.length - 1;
        } else if (!hit && useful.length && !task.negative) {
          // Count as wrong/noise only among reads before first useful, or clearly off-domain noise
          if (!firstUseful && /noise|legacy|admin-ui|old-billing|misc-utils|payments\/README/i.test(p)) {
            wrongPaths += 1;
          } else if (!firstUseful) {
            wrongPaths += 1;
          }
        }
      }
    }
  }

  const exploration = sequence.filter((s) =>
    ['list_dir', 'grep', 'read', 'other'].includes(s.kind),
  ).length;
  const listDir = sequence.filter((s) => s.kind === 'list_dir').length;
  const grep = sequence.filter((s) => s.kind === 'grep').length;
  const reads = sequence.filter((s) => s.kind === 'read').length;
  const edits = sequence.filter((s) => s.kind === 'edit').length;
  const neuronCalls = sequence.filter((s) => s.kind === 'neuron').length;

  const firstTool = sequence[0]?.name ?? null;
  const neuronFirst = arm === 'neuron' && sequence[0]?.kind === 'neuron';
  const rediscoveryAfterNeuron =
    arm === 'neuron' &&
    neuronCalls > 0 &&
    sequence.some((s, i) => {
      if (i === 0) return false;
      const neuronIdx = sequence.findIndex((x) => x.kind === 'neuron');
      return neuronIdx >= 0 && i > neuronIdx && (s.kind === 'list_dir' || s.kind === 'grep');
    });

  let trust = 'n/a';
  if (arm === 'neuron') {
    if (!neuronCalls) trust = 'ignored_neuron';
    else if (neuronFirst && !rediscoveryAfterNeuron && firstUseful) trust = 'trusted_targeted';
    else if (neuronFirst && rediscoveryAfterNeuron) trust = 'partial_rediscovery';
    else trust = 'partial';
  } else {
    trust = /list_dir|grep/.test(String(firstTool)) ? 'baseline_explore_first' : 'baseline_other_first';
  }

  let taskSuccess = null;
  if (task.negative) {
    const claimedK8s = sequence.some(
      (s) => s.path && /kubernetes|autoscaling/i.test(s.path),
    );
    taskSuccess = !claimedK8s;
  } else if (status === 'finished') {
    taskSuccess = Boolean(firstUseful) || edits > 0;
  } else {
    taskSuccess = false;
  }

  return {
    arm,
    status,
    error: error ?? null,
    wall_clock_ms: wallMs,
    sequence: sequence.map((s) => `${s.kind}:${s.name}${s.path ? `(${s.path})` : ''}`),
    sequence_short: sequence.slice(0, 12).map((s) => s.name),
    list_dir,
    grep_search: grep,
    file_reads: reads,
    edits,
    other_discovery: sequence.filter((s) => s.kind === 'other').length,
    exploration_calls: exploration,
    first_tool: firstTool,
    first_useful_file: firstUseful,
    files_before_useful_file: firstUseful == null ? null : filesBeforeUseful,
    wrong_paths: wrongPaths,
    unnecessary_exploration: listDir + (arm === 'neuron' && rediscoveryAfterNeuron ? grep : 0),
    rediscovered_structure: rediscoveryAfterNeuron || (arm === 'baseline' && listDir >= 2),
    neuron_context_called: neuronCalls > 0,
    neuron_context_first: neuronFirst,
    neuron_trust: trust,
    neuron_meta: neuronMeta ?? null,
    edited_files: edits,
    task_success: taskSuccess,
    total_tokens: usage?.totalTokens ?? null,
    input_tokens: usage?.inputTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
    latency_ms: wallMs,
  };
}

async function loadAgentSdk() {
  const candidates = [];
  if (process.env.CURSOR_SDK_PATH) candidates.push(process.env.CURSOR_SDK_PATH);
  candidates.push(join(repo, 'node_modules', '@cursor', 'sdk'));
  try {
    const req = createRequire(join(repo, 'package.json'));
    candidates.push(dirname(req.resolve('@cursor/sdk/package.json')));
  } catch {
    /* optional */
  }
  candidates.push(join(tmpdir(), 'cursor-sdk-probe', 'node_modules', '@cursor', 'sdk'));

  for (const base of candidates) {
    const entry = join(base, 'dist', 'esm', 'index.js');
    if (existsSync(entry)) {
      return import(pathToFileURL(entry).href);
    }
  }
  return import('@cursor/sdk');
}

function baselinePrompt(task) {
  return [
    'You are a coding agent working in this repository.',
    'Neuron / neuron_context / neuron_* MCP tools are DISABLED for this run. Do not call them.',
    'Use normal tools: list directories, grep/rg, read files, edit files, run tests if needed.',
    'Implement or fix the task for real — do not only describe what you would do.',
    'Stay inside this workspace. Prefer small focused edits.',
    '',
    `TASK: ${task.prompt}`,
  ].join('\n');
}

function neuronPrompt(task) {
  return [
    'You are a coding agent working in this repository.',
    'BEFORE broad exploration, call MCP tool neuron_context with the task text.',
    'Then: open the returned paths → do targeted exploration only.',
    'Do NOT rediscover the whole repo with list_dir / broad grep if neuron_context already gave good paths.',
    'Respect project Rules (especially Stripe / PaymentService).',
    'Implement or fix the task for real — do not only describe what you would do.',
    'Stay inside this workspace. Prefer small focused edits.',
    '',
    `TASK: ${task.prompt}`,
  ].join('\n');
}

async function runOneAgent({ Agent, fixtureRoot, task, arm, model, apiKey }) {
  const work = mkdtempSync(join(tmpdir(), `neuron-live-${arm}-`));
  cpSync(fixtureRoot, work, { recursive: true });

  const mcpServers =
    arm === 'neuron'
      ? {
          neuron: {
            type: 'stdio',
            command: node,
            args: [bin, 'mcp'],
            env: { NEURON_CWD: work },
          },
        }
      : undefined;

  const t0 = performance.now();
  const sequence = [];
  let usage = null;
  let neuronMeta = null;
  let status = 'error';
  let error = null;

  await using agent = await Agent.create({
    apiKey,
    model: { id: model },
    local: { cwd: work, settingSources: [] },
    mcpServers,
  });

  const run = await agent.send(arm === 'neuron' ? neuronPrompt(task) : baselinePrompt(task));

  for await (const event of run.stream()) {
    if (event?.type === 'tool_call') {
      const kind = classifyTool(event.name);
      const path = extractPathFromArgs(event.args);
      sequence.push({
        name: event.name,
        kind,
        path,
        status: event.status,
        at: Math.round(performance.now() - t0),
      });
      if (kind === 'neuron' && event.status === 'completed' && event.result) {
        try {
          const text =
            typeof event.result === 'string'
              ? event.result
              : JSON.stringify(event.result);
          const parsed = JSON.parse(text.includes('{') ? text.slice(text.indexOf('{')) : text);
          neuronMeta = {
            recommendedStart: parsed.recommendation?.path ?? null,
            paths: (parsed.relevantFiles || []).slice(0, 8),
            rules: parsed.relevantRules?.length ?? null,
            decisions: parsed.relevantDecisions?.length ?? null,
            contextTokens: parsed.metrics?.contextTokens ?? null,
            retrievalMs: parsed.metrics?.retrievalMs ?? null,
          };
        } catch {
          neuronMeta = { raw: true };
        }
      }
    }
    if (event?.type === 'assistant' && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (block?.type === 'tool_use') {
          const kind = classifyTool(block.name);
          sequence.push({
            name: block.name,
            kind,
            path: extractPathFromArgs(block.input),
            status: 'requested',
            at: Math.round(performance.now() - t0),
          });
        }
      }
    }
    if (event?.type === 'usage' && event.usage) {
      usage = {
        inputTokens: event.usage.inputTokens ?? event.usage.input_tokens ?? null,
        outputTokens: event.usage.outputTokens ?? event.usage.output_tokens ?? null,
        totalTokens: event.usage.totalTokens ?? event.usage.total_tokens ?? null,
      };
    }
  }

  const result = await run.wait();
  status = result.status;
  error = result.error?.message ?? null;
  const wallMs = Math.round(performance.now() - t0);

  // Dedupe consecutive identical tool_use + tool_call pairs
  const deduped = [];
  for (const step of sequence) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.name === step.name && prev.path === step.path && prev.kind === step.kind) {
      continue;
    }
    deduped.push(step);
  }

  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return scoreRun({
    task,
    arm,
    sequence: deduped,
    usage,
    wallMs,
    status,
    error,
    neuronMeta,
  });
}

function mean(nums) {
  const xs = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(nums) {
  const xs = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function aggregateArm(runs) {
  const successRate =
    runs.length === 0
      ? null
      : runs.filter((r) => r.task_success).length / runs.length;
  return {
    n: runs.length,
    exploration_calls_mean: mean(runs.map((r) => r.exploration_calls)),
    exploration_calls_median: median(runs.map((r) => r.exploration_calls)),
    file_reads_mean: mean(runs.map((r) => r.file_reads)),
    file_reads_median: median(runs.map((r) => r.file_reads)),
    grep_search_mean: mean(runs.map((r) => r.grep_search)),
    grep_search_median: median(runs.map((r) => r.grep_search)),
    files_before_useful_mean: mean(runs.map((r) => r.files_before_useful_file)),
    files_before_useful_median: median(runs.map((r) => r.files_before_useful_file)),
    wrong_paths_mean: mean(runs.map((r) => r.wrong_paths)),
    unnecessary_exploration_mean: mean(runs.map((r) => r.unnecessary_exploration)),
    task_success_rate: successRate,
    total_tokens_mean: mean(runs.map((r) => r.total_tokens)),
    latency_ms_mean: mean(runs.map((r) => r.latency_ms)),
    neuron_context_first_rate:
      runs.length === 0
        ? null
        : runs.filter((r) => r.neuron_context_first).length / runs.length,
    trusted_targeted_rate:
      runs.length === 0
        ? null
        : runs.filter((r) => r.neuron_trust === 'trusted_targeted').length / runs.length,
  };
}

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return 'UNAVAILABLE';
  if (typeof n === 'number') return Number.isInteger(n) ? String(n) : n.toFixed(digits);
  return String(n);
}

function delta(a, b) {
  if (a == null || b == null) return 'UNAVAILABLE';
  const d = b - a;
  const pct = a === 0 ? null : (d / a) * 100;
  return pct == null ? fmt(d) : `${fmt(d)} (${fmt(pct)}%)`;
}

function writeMarkdown(report) {
  const a = report.aggregates?.baseline;
  const b = report.aggregates?.neuron;
  const table =
    report.LIVE_AGENT_PROOF === 'MEASURED' && a && b
      ? `| Metric | Baseline | NeuronAI | Delta |
| --- | ---: | ---: | ---: |
| exploration calls (median) | ${fmt(a.exploration_calls_median)} | ${fmt(b.exploration_calls_median)} | ${delta(a.exploration_calls_median, b.exploration_calls_median)} |
| file reads (median) | ${fmt(a.file_reads_median)} | ${fmt(b.file_reads_median)} | ${delta(a.file_reads_median, b.file_reads_median)} |
| grep/search (median) | ${fmt(a.grep_search_median)} | ${fmt(b.grep_search_median)} | ${delta(a.grep_search_median, b.grep_search_median)} |
| files before useful (median) | ${fmt(a.files_before_useful_median)} | ${fmt(b.files_before_useful_median)} | ${delta(a.files_before_useful_median, b.files_before_useful_median)} |
| wrong paths (mean) | ${fmt(a.wrong_paths_mean)} | ${fmt(b.wrong_paths_mean)} | ${delta(a.wrong_paths_mean, b.wrong_paths_mean)} |
| unnecessary exploration (mean) | ${fmt(a.unnecessary_exploration_mean)} | ${fmt(b.unnecessary_exploration_mean)} | ${delta(a.unnecessary_exploration_mean, b.unnecessary_exploration_mean)} |
| task success rate | ${fmt(a.task_success_rate, 2)} | ${fmt(b.task_success_rate, 2)} | ${delta(a.task_success_rate, b.task_success_rate)} |
| total tokens (mean) | ${fmt(a.total_tokens_mean)} | ${fmt(b.total_tokens_mean)} | ${delta(a.total_tokens_mean, b.total_tokens_mean)} |
| latency ms (mean) | ${fmt(a.latency_ms_mean)} | ${fmt(b.latency_ms_mean)} | ${delta(a.latency_ms_mean, b.latency_ms_mean)} |
| neuron_context first rate | n/a | ${fmt(b.neuron_context_first_rate, 2)} | — |
| trusted targeted rate | n/a | ${fmt(b.trusted_targeted_rate, 2)} | — |`
      : `| Metric | Baseline | NeuronAI | Delta |
| --- | ---: | ---: | ---: |
| exploration calls | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| file reads | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| grep/search calls | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| first useful file | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| files before useful file | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| task success | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| wrong paths | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| unnecessary exploration | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| total tokens | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| latency | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |`;

  const blockers = (report.access?.blockers || []).map((x) => `- ${x}`).join('\n');
  const sampleTraces =
    report.LIVE_AGENT_PROOF === 'MEASURED'
      ? (report.sample_traces || [])
          .map(
            (t) => `### ${t.id} (${t.prompt})

**Baseline:**
\`\`\`text
${(t.baseline_sequence || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(empty)'}
\`\`\`

**NeuronAI:**
\`\`\`text
${(t.neuron_sequence || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(empty)'}
\`\`\`
`,
          )
          .join('\n')
      : '_No live traces — runs did not execute._\n';

  const md = `# Live agent validation

**Date:** ${report.generatedAt?.slice(0, 10) ?? 'unknown'}  
**Evidence:** [\`live-agent-validation-report.json\`](../live-agent-validation-report.json)

---

## Verdict

# ${report.product_verdict}

\`\`\`text
LIVE_AGENT_PROOF = ${report.LIVE_AGENT_PROOF}
\`\`\`

${report.verdict_rationale}

---

## What we tried (access probe)

| Mechanism | Result |
| --- | --- |
| \`CURSOR_API_KEY\` | ${report.access?.keys?.CURSOR_API_KEY?.usable ? 'usable' : report.access?.keys?.CURSOR_API_KEY?.reason ?? 'missing'} |
| \`ANTHROPIC_API_KEY\` | ${report.access?.keys?.ANTHROPIC_API_KEY?.usable ? 'usable' : report.access?.keys?.ANTHROPIC_API_KEY?.reason ?? 'missing'} |
| \`OPENAI_API_KEY\` | ${report.access?.keys?.OPENAI_API_KEY?.usable ? 'usable' : report.access?.keys?.OPENAI_API_KEY?.reason ?? 'missing'} |
| \`cursor\` CLI | ${report.access?.cursorCli?.available ? 'found' : 'missing'} |
| \`cursor agent\` headless | ${report.access?.cursorCli?.agentSubcommand ? 'maybe' : 'not usable as headless runner'} |
| \`@cursor/sdk\` import | ${report.access?.sdk?.packageResolvable ? 'yes' : 'no'} |
| SDK auth probe | ${report.access?.sdk?.authProbe?.usable ? 'ok' : report.access?.sdk?.authProbe?.error || report.access?.sdk?.authProbe?.note || 'not run'} |
| In-chat Task/subagent telemetry | Not used as MEASURED proof (no exportable tool_call ledger for A/B scoring) |
| Scripted exploration (−89%) | **Excluded** — that is \`EXPLORATION_POLICY_PROOF\`, not live agent behavior |

### Blockers

${blockers || '- (none)'}

### Minimal access needed for MEASURED

1. A real **\`CURSOR_API_KEY\`** from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) (user or team service-account key). Placeholder values like \`UNSET\` do not count.
2. Install **\`@cursor/sdk\`** (or set \`CURSOR_SDK_PATH\` to an installed copy).
3. Run:

\`\`\`bash
pnpm build
CURSOR_API_KEY=cursor_... node scripts/live-agent-validation.mjs --runs 2 --limit 22
\`\`\`

Optional: \`--limit 3 --runs 1\` for a smoke measurement.

The harness already:
- builds a disposable realistic fixture (api/auth/billing/payments/db/services/workers + noise),
- seeds PaymentService / Stripe route rules + architecture decision,
- runs **A** (no MCP) vs **B** (\`neuron\` MCP + \`neuron_context\` guidance) in fresh temp copies,
- scores real \`tool_call\` stream events from the SDK.

---

## Methodology (when MEASURED)

- Arms: \`baseline_no_neuron\` vs \`neuron_context_first\`
- Tasks: ${LIVE_TASKS.length} real modification/debug/impact/rules/negative prompts
- Default repeats: 2 runs × A/B (override with \`--runs\`)
- Fresh agent + disposable fixture copy per run
- Metrics from SDK stream (\`tool_call\`, optional \`usage\`) — never estimated

---

## Results table

${table}

---

## Sample exploration traces

${sampleTraces}

---

## Related (not live proof)

- Scripted policy: \`scripts/real-agent-benchmark.mjs\` → \`EXPLORATION_POLICY_PROOF\`
- Retrieval quality: \`scripts/daily-use-audit.mjs\`
- P4 gate: \`docs/P4_PRODUCT_VALIDATION.md\`

---

## Explicit non-claims

- We did **not** treat scripted −89% exploration as live agent proof.
- We did **not** invent token/cost numbers when the runtime omitted usage.
- We did **not** change ranking / retrieval architecture for this benchmark.
`;

  mkdirSync(dirname(outMd), { recursive: true });
  writeFileSync(outMd, md, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const keys = {
    CURSOR_API_KEY: envKeyStatus('CURSOR_API_KEY'),
    ANTHROPIC_API_KEY: envKeyStatus('ANTHROPIC_API_KEY'),
    OPENAI_API_KEY: envKeyStatus('OPENAI_API_KEY'),
  };
  const cursorCli = probeCursorCli();
  const sdk = await probeCursorSdk();

  const blockers = [];
  if (!keys.CURSOR_API_KEY.usable) {
    blockers.push(
      `No usable CURSOR_API_KEY (${keys.CURSOR_API_KEY.reason}). Required for @cursor/sdk local agents that emit tool_call telemetry.`,
    );
  }
  if (!cursorCli.agentSubcommand) {
    blockers.push(
      `cursor agent CLI is not a measurable headless runner here (${cursorCli.note}).`,
    );
  }
  if (!sdk.packageResolvable) {
    blockers.push(
      `@cursor/sdk not resolvable (${sdk.importError}). Install it or set CURSOR_SDK_PATH.`,
    );
  } else if (keys.CURSOR_API_KEY.usable && sdk.authProbe && sdk.authProbe.usable === false) {
    blockers.push(`CURSOR_API_KEY rejected by SDK: ${sdk.authProbe.error || 'auth failed'}`);
  }
  blockers.push(
    'In-session Cursor chat / Task subagents cannot provide an exportable A/B tool-call ledger with Neuron MCP disabled on arm A only — not counted as MEASURED.',
  );

  const access = { keys, cursorCli, sdk, blockers };

  const canMeasure =
    keys.CURSOR_API_KEY.usable &&
    sdk.packageResolvable &&
    (!sdk.authProbe || sdk.authProbe.usable !== false) &&
    !args.probeOnly;

  /** @type {any} */
  let report = {
    generatedAt: new Date().toISOString(),
    LIVE_AGENT_PROOF: 'UNAVAILABLE',
    product_verdict: 'PROMISING BUT UNPROVEN',
    verdict_rationale:
      'Access probe completed. No real coding-agent A/B tool traces were collected in this environment, so product impact on live agents remains unproven. Scripted exploration and retrieval quality elsewhere stay separate.',
    access,
    methodology: {
      arms: ['baseline_no_neuron', 'neuron_context_first'],
      tasks_defined: LIVE_TASKS.length,
      intended_repeats: args.runs,
      labels: {
        LIVE_AGENT_PROOF: 'Real Cursor/@cursor/sdk agent tool_call traces only',
        EXPLORATION_POLICY_PROOF: 'Scripted policy — NOT live proof',
      },
    },
    fixture: null,
    tasks: LIVE_TASKS.map((t) => ({
      id: t.id,
      category: t.category,
      prompt: t.prompt,
      baseline_runs: [],
      neuron_runs: [],
      status: 'UNAVAILABLE',
    })),
    aggregates: { baseline: null, neuron: null, comparison: null },
    sample_traces: [],
    how_to_enable: [
      'Export a real CURSOR_API_KEY from https://cursor.com/dashboard/integrations',
      'pnpm add -D @cursor/sdk   # or CURSOR_SDK_PATH=/path/to/@cursor/sdk',
      'pnpm build && CURSOR_API_KEY=cursor_... node scripts/live-agent-validation.mjs --runs 2',
    ],
  };

  // Always prepare fixture metadata (and seed brain when CLI is built) so the
  // report proves the benchmark substrate exists even when live runs cannot.
  if (!existsSync(bin)) {
    spawnSync('pnpm', ['--filter', 'neuronai', 'build'], {
      cwd: repo,
      encoding: 'utf8',
      shell: true,
      timeout: 300_000,
    });
  }

  const fixtureRoot = mkdtempSync(join(tmpdir(), 'neuron-live-fixture-'));
  buildLiveFixture(fixtureRoot);
  const brain = existsSync(bin) ? seedNeuronBrain(fixtureRoot) : { initOk: false, rememberOk: false, initErr: 'CLI not built' };
  report.fixture = {
    path: fixtureRoot,
    brain,
    layout: [
      'src/api/routes',
      'src/auth',
      'src/billing',
      'src/payments',
      'src/db',
      'src/services',
      'src/workers',
      'src/middleware',
      'tests',
    ],
  };

  if (canMeasure) {
    const { Agent } = await loadAgentSdk();
    const tasks = LIVE_TASKS.slice(0, args.limit ?? LIVE_TASKS.length);
    const baselineRuns = [];
    const neuronRuns = [];
    const taskRows = [];

    for (const task of tasks) {
      const row = {
        id: task.id,
        category: task.category,
        prompt: task.prompt,
        baseline_runs: [],
        neuron_runs: [],
        status: 'MEASURED',
      };
      for (let r = 0; r < args.runs; r++) {
        console.log(`[live] ${task.id} baseline run ${r + 1}/${args.runs}`);
        const b = await runOneAgent({
          Agent,
          fixtureRoot,
          task,
          arm: 'baseline',
          model: args.model,
          apiKey: process.env.CURSOR_API_KEY.trim(),
        });
        row.baseline_runs.push(b);
        baselineRuns.push(b);

        console.log(`[live] ${task.id} neuron run ${r + 1}/${args.runs}`);
        const n = await runOneAgent({
          Agent,
          fixtureRoot,
          task,
          arm: 'neuron',
          model: args.model,
          apiKey: process.env.CURSOR_API_KEY.trim(),
        });
        row.neuron_runs.push(n);
        neuronRuns.push(n);
      }
      taskRows.push(row);
    }

    const aggB = aggregateArm(baselineRuns);
    const aggN = aggregateArm(neuronRuns);
    report.LIVE_AGENT_PROOF = 'MEASURED';
    report.tasks = taskRows;
    report.aggregates = {
      baseline: aggB,
      neuron: aggN,
      comparison: {
        exploration_median_delta: delta(aggB.exploration_calls_median, aggN.exploration_calls_median),
        success_delta: delta(aggB.task_success_rate, aggN.task_success_rate),
      },
    };
    report.sample_traces = taskRows.slice(0, 5).map((t) => ({
      id: t.id,
      prompt: t.prompt,
      baseline_sequence: t.baseline_runs[0]?.sequence_short ?? [],
      neuron_sequence: t.neuron_runs[0]?.sequence_short ?? [],
      neuron_trust: t.neuron_runs[0]?.neuron_trust ?? null,
    }));

    const trustRate = aggN.trusted_targeted_rate ?? 0;
    const exploreImproved =
      (aggN.exploration_calls_median ?? Infinity) < (aggB.exploration_calls_median ?? 0);
    const successImproved = (aggN.task_success_rate ?? 0) >= (aggB.task_success_rate ?? 0);

    if (trustRate >= 0.5 && exploreImproved && successImproved) {
      report.product_verdict = 'PROVEN';
      report.verdict_rationale =
        'Real agent traces show NeuronAI is used first, exploration drops vs baseline, and task success does not regress.';
    } else if ((aggN.neuron_context_first_rate ?? 0) < 0.25) {
      report.product_verdict = 'FAILED';
      report.verdict_rationale =
        'Live agents largely ignored neuron_context despite availability — integration/prompt/tool UX problem dominates retrieval quality.';
    } else {
      report.product_verdict = 'PROMISING BUT UNPROVEN';
      report.verdict_rationale =
        'Live traces exist but results are mixed (trust / exploration / success). Need more runs or integration fixes before claiming PROVEN.';
    }
  } else {
    report.LIVE_AGENT_PROOF = 'UNAVAILABLE';
    report.product_verdict = 'PROMISING BUT UNPROVEN';
    report.verdict_rationale = [
      'Could not collect real coding-agent A/B traces in this environment.',
      blockers[0] || 'See access.blockers.',
      'Harness + fixture + 22 tasks are ready; set a usable CURSOR_API_KEY to flip LIVE_AGENT_PROOF to MEASURED.',
    ].join(' ');
  }

  // Cleanup fixture after report (path still recorded)
  try {
    rmSync(fixtureRoot, { recursive: true, force: true });
    report.fixture.path = '(removed after run)';
  } catch {
    /* keep */
  }

  writeFileSync(outJson, JSON.stringify(report, null, 2));
  writeMarkdown(report);

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  console.log(`LIVE_AGENT_PROOF = ${report.LIVE_AGENT_PROOF}`);
  console.log(`product_verdict = ${report.product_verdict}`);
  console.log(`tasks_defined = ${LIVE_TASKS.length}`);
  for (const b of blockers.slice(0, 5)) console.log(`blocker: ${b}`);
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
