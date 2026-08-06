#!/usr/bin/env node
/**
 * P1 deep-code proof — trustworthy structural context via neuron_context (MCP).
 * estimatedRediscoveryAvoided is simulated — not measured agent file-read savings.
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
import { createRequire } from 'node:module';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const neuronBin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

function write(root, rel, body) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

function run(args, cwd) {
  const r = spawnSync(node, [neuronBin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`neuron ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

function buildFixture(root) {
  write(root, 'package.json', JSON.stringify({ name: 'acme-payments', type: 'module' }));
  write(
    root,
    'src/billing/service.ts',
    `export class BillingService {
  createInvoice(amount: number) { return { id: 'inv', amount }; }
  cancelInvoice(id: string) { return { id, status: 'cancelled' }; }
}
`,
  );
  write(
    root,
    'src/billing/repository.ts',
    `export class InvoiceRepository {
  find(id: string) { return { id }; }
  update(id: string, patch: object) { return { id, ...patch }; }
}
`,
  );
  write(
    root,
    'src/services/stripe.ts',
    `export class StripeClient {
  createPayment() { return 'ok'; }
}
`,
  );
  write(
    root,
    'src/billing/routes.ts',
    `import { Router } from 'express';
import { BillingService } from './service';

const router = Router();
const billing = new BillingService();

export function createInvoiceHandler() {
  return billing.createInvoice(10);
}

export function cancelInvoiceHandler() {
  return billing.cancelInvoice('inv');
}

router.post('/invoices', createInvoiceHandler);
router.post('/invoices/:id/cancel', cancelInvoiceHandler);
export default router;
`,
  );
  write(
    root,
    'tests/billing/invoices.test.ts',
    `import { BillingService } from '../../src/billing/service';
test('cancel', () => { expect(new BillingService().cancelInvoice('x').status).toBe('cancelled'); });
`,
  );
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
  const client = new Client({ name: 'deep-code-proof', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function ask(client, task) {
  const result = await client.callTool({ name: 'neuron_context', arguments: { task } });
  const text = result.content?.map((c) => c.text).join('\n') ?? '';
  const start = text.indexOf('{');
  return start >= 0 ? JSON.parse(text.slice(start)) : {};
}

function score(spec, body) {
  const blob = JSON.stringify(body).toLowerCase();
  if (spec.empty) {
    const files = body.relevantFiles?.length ?? 0;
    if (!body.recommendation && files <= 1) return 'correct';
    if (/kubernetes|terraform|lambda/.test(blob) && files > 2) return 'incorrect';
    return files === 0 ? 'correct' : 'acceptable';
  }
  if (spec.expect?.test(blob)) return 'correct';
  if (spec.soft) return 'acceptable';
  return 'incorrect';
}

const root = mkdtempSync(join(tmpdir(), 'neuron-deep-'));
buildFixture(root);
run(['init', '--yes'], root);
run(
  [
    'remember',
    'Never call Stripe directly from route handlers. Payment provider calls belong in services, not route handlers.',
    '--yes',
    '--type',
    'business_rule',
  ],
  root,
);

const queries = [
  { q: 'Where is billing implemented?', expect: /billing/i },
  { q: 'Where should I implement invoice cancellation?', expect: /cancel|billing|invoice/i },
  { q: 'What calls BillingService?', expect: /routes|billingservice|call|depend/i },
  { q: 'What does BillingService depend on?', soft: true },
  { q: 'What happens when POST /invoices/:id/cancel is called?', expect: /cancel|billing|route|invoice/i },
  {
    q: 'What files would I likely need to change to modify payment processing?',
    expect: /billing|stripe|route|invoice/i,
  },
  { q: 'How does Kubernetes deployment work?', empty: true },
];

const rows = await withMcp(root, async (client) => {
  const out = [];
  for (const spec of queries) {
    const body = await ask(client, spec.q);
    const verdict = score(spec, body);
    out.push({
      query: spec.q,
      intent: body.intent,
      recommendation: body.recommendation?.path ?? null,
      symbol: body.recommendation?.symbol ?? null,
      flow: body.flow ?? body.recommendation?.flow ?? null,
      contextTokens: body.metrics?.contextTokens ?? null,
      retrievalMs: body.metrics?.retrievalMs ?? null,
      estimatedRediscoveryAvoided: body.metrics?.estimatedRediscoveryAvoided ?? null,
      verdict,
    });
    console.log(`${verdict.padEnd(10)} ${spec.q}`);
  }
  return out;
});

const knowledge = JSON.parse(readFileSync(join(root, '.neuron', 'brain', 'knowledge.json'), 'utf8'));
const code = knowledge.code;
const highCalls = (code?.edges ?? []).filter((e) => e.type === 'CALLS' && e.confidence === 'high');
const lowCalls = (code?.edges ?? []).filter((e) => e.type === 'CALLS' && e.confidence === 'low');
const ok = rows.filter((r) => r.verdict !== 'incorrect').length;

const report = {
  generatedAt: new Date().toISOString(),
  queries: rows,
  summary: {
    ok,
    total: queries.length,
    pct: Math.round((1000 * ok) / queries.length) / 10,
    symbols: code?.symbols?.length ?? 0,
    edges: code?.edges?.length ?? 0,
    highConfidenceCalls: highCalls.length,
    lowConfidenceCalls: lowCalls.length,
  },
  trust: {
    everyEdgeHasEvidence: (code?.edges ?? []).every((e) => e.evidence?.detail),
    noLowConfidenceCalls: lowCalls.length === 0,
    codePlanePresent: Boolean(code),
  },
};

writeFileSync(join(repo, 'deep-code-proof-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('\n', JSON.stringify(report.summary));
console.log('trust', report.trust);
rmSync(root, { recursive: true, force: true });

if (report.summary.pct < 85 || !report.trust.everyEdgeHasEvidence || !report.trust.noLowConfidenceCalls) {
  process.exitCode = 1;
} else {
  console.log('DEEP_CODE_PROOF_OK');
}
