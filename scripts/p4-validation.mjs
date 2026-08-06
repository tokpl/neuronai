#!/usr/bin/env node
/**
 * P4 — Product validation & production hardening gate.
 *
 * Runs measured checks. Never invents live-agent savings.
 *
 * Usage: node scripts/p4-validation.mjs
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
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
import { performance } from 'node:perf_hooks';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const report = {
  generatedAt: new Date().toISOString(),
  LIVE_AGENT_PROOF: 'UNAVAILABLE',
  EXPLORATION_POLICY_PROOF: null,
  sections: {},
  blockers: [],
  bugsFixed: [],
  bugsLeft: [],
  verdict: 'NOT READY',
};

function write(root, rel, body = '') {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function runCli(args, cwd) {
  const t0 = performance.now();
  const r = spawnSync(node, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
    ms: Math.round(performance.now() - t0),
    status: r.status ?? 1,
  };
}

function buildFixture(root) {
  write(root, 'package.json', JSON.stringify({ name: 'p4-app', type: 'module' }));
  write(
    root,
    'src/billing/invoices.ts',
    `import { PaymentService } from '../services/payment.js';
export class InvoiceService {
  private payments = new PaymentService();
  createInvoice() { return this.payments.createPayment({ amount: 10 }); }
  cancelInvoice(id: string) { return this.payments.cancelInvoice(id); }
}
`,
  );
  write(
    root,
    'src/services/payment.ts',
    `export class PaymentService {
  createPayment(input: { amount: number }) { return input; }
  cancelInvoice(id: string) { return { id, cancelled: true }; }
}
`,
  );
  write(
    root,
    'src/api/routes/payments.ts',
    `import { Router } from 'express';
import { InvoiceService } from '../../billing/invoices.js';
const router = Router();
const invoices = new InvoiceService();
export function cancelHandler(req: any) { return invoices.cancelInvoice(req.params.id); }
router.post('/invoices/:id/cancel', cancelHandler);
export default router;
`,
  );
  write(
    root,
    'tests/billing/invoices.test.ts',
    `import { InvoiceService } from '../../src/billing/invoices.js';
test('cancel', () => { expect(new InvoiceService()).toBeTruthy(); });
`,
  );
}

async function withMcp(cwd, fn) {
  const transport = new StdioClientTransport({
    command: node,
    args: [bin, 'mcp'],
    env: { ...process.env, NEURON_CWD: cwd },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'p4', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

async function ask(client, task) {
  const t0 = performance.now();
  const res = await client.callTool({ name: 'neuron_context', arguments: { task } });
  const text = res.content?.find((c) => c.type === 'text')?.text ?? '';
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { context: text };
  }
  return { body, ms: Math.round(performance.now() - t0) };
}

async function sectionMutation() {
  console.log('\n=== Mutation / rename / delete ===');
  const root = mkdtempSync(join(tmpdir(), 'neuron-p4-mut-'));
  buildFixture(root);
  runCli(['init', '--yes'], root);
  runCli(
    [
      'remember',
      'Never call Stripe directly from route handlers.',
      '--yes',
      '--type',
      'business_rule',
    ],
    root,
  );

  const before = await withMcp(root, async (client) => {
    const { body } = await ask(client, 'Add invoice cancellation.');
    return {
      rec: body.recommendation?.path ?? null,
      rules: body.relevantRules?.length ?? 0,
      tokens: body.metrics?.contextTokens ?? null,
      context: String(body.context ?? ''),
    };
  });

  // rename billing → payments
  renameSync(join(root, 'src', 'billing'), join(root, 'src', 'payments'));
  runCli(['scan', '--update'], root);
  const afterRename = await withMcp(root, async (client) => {
    const { body } = await ask(client, 'Where should I implement invoice cancellation?');
    const blob = JSON.stringify(body);
    return {
      staleBilling: /src\/billing\//.test(blob),
      hasPayments: /src\/payments\//.test(blob),
      rec: body.recommendation?.path ?? null,
      rules: body.relevantRules?.length ?? 0,
    };
  });

  // delete invoices module
  rmSync(join(root, 'src', 'payments', 'invoices.ts'), { force: true });
  runCli(['scan', '--update'], root);
  const afterDelete = await withMcp(root, async (client) => {
    const { body } = await ask(client, 'Where is InvoiceService?');
    const blob = JSON.stringify(body);
    return {
      staleInvoiceFile: /invoices\.ts/.test(blob) && /src\/payments\/invoices/.test(blob),
      rulesSurvived: (body.relevantRules ?? []).some((r) => /Stripe/i.test(r.title + r.detail)),
    };
  });

  // user memory survival check via store
  const store = JSON.parse(readFileSync(join(root, '.neuron', 'runtime', 'store.json'), 'utf8'));
  const userRule = (store.memories ?? []).some(
    (m) => m.source === 'user' && /Stripe/i.test(m.title + m.content),
  );

  rmSync(root, { recursive: true, force: true });

  const ok =
    !afterRename.staleBilling &&
    afterRename.hasPayments &&
    !afterDelete.staleInvoiceFile &&
    userRule;

  console.log(
    `  beforeRec=${before.rec} renameStale=${afterRename.staleBilling} payments=${afterRename.hasPayments} deleteStale=${afterDelete.staleInvoiceFile} userRule=${userRule}`,
  );

  if (!ok) report.blockers.push('Mutation/rename/delete left stale paths or dropped user memory');
  return { before, afterRename, afterDelete, userRule, ok };
}

async function sectionContextQuality() {
  console.log('\n=== Context quality (connected slice) ===');
  const root = mkdtempSync(join(tmpdir(), 'neuron-p4-ctx-'));
  buildFixture(root);
  runCli(['init', '--yes'], root);
  runCli(
    [
      'remember',
      'Never call Stripe directly from route handlers.',
      '--yes',
      '--type',
      'business_rule',
    ],
    root,
  );
  runCli(
    [
      'remember',
      'Decision: Billing logic belongs in the billing/payments service layer.',
      '--yes',
      '--type',
      'architecture_decision',
    ],
    root,
  );

  const sample = await withMcp(root, async (client) => {
    const { body, ms } = await ask(client, 'Add support for cancelling invoices.');
    const ctx = String(body.context ?? '');
    return {
      ms,
      tokens: body.metrics?.contextTokens ?? null,
      retrievalMs: body.metrics?.retrievalMs ?? null,
      hasStart: /## Recommended start/i.test(ctx),
      hasRelated: /## Related/i.test(ctx),
      hasDeps: /## Depends on/i.test(ctx),
      hasRules: /## Rules/i.test(ctx),
      hasDecisions: /## Decisions/i.test(ctx),
      rec: body.recommendation?.path ?? null,
      rules: body.relevantRules?.length ?? 0,
      fabricatedKafka: /kafka/i.test(ctx),
      snippet: ctx.split('\n').slice(0, 24).join('\n'),
    };
  });

  const neg = await withMcp(root, async (client) => {
    const { body } = await ask(client, 'Where is Terraform?');
    const ctx = String(body.context ?? '');
    const empty =
      /no stored project knowledge|no matching/i.test(ctx) && !body.recommendation;
    return { empty, rec: body.recommendation?.path ?? null, fabricated: /terraform/i.test(body.recommendation?.path ?? '') };
  });

  rmSync(root, { recursive: true, force: true });

  const ok =
    sample.hasStart &&
    sample.tokens != null &&
    sample.tokens <= 350 &&
    (sample.retrievalMs ?? 99) < 20 &&
    !sample.fabricatedKafka &&
    (neg.empty || !neg.fabricated);

  console.log(
    `  tokens=${sample.tokens} retrievalMs=${sample.retrievalMs} start=${sample.hasStart} rules=${sample.hasRules} negEmpty=${neg.empty}`,
  );
  if (!ok) report.blockers.push('Context quality below P4 bar');
  return { sample, neg, ok };
}

function sectionDoctorGit() {
  console.log('\n=== Doctor git HEAD awareness ===');
  const root = mkdtempSync(join(tmpdir(), 'neuron-p4-git-'));
  buildFixture(root);
  // init git
  spawnSync('git', ['init'], { cwd: root, encoding: 'utf8', windowsHide: true });
  spawnSync('git', ['config', 'user.email', 'p4@test.local'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'P4'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['add', '.'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: root, encoding: 'utf8' });
  runCli(['init', '--yes'], root);
  runCli(['scan'], root);
  const meta1 = JSON.parse(readFileSync(join(root, '.neuron', 'metadata.json'), 'utf8'));
  write(root, 'src/extra.ts', 'export const x = 1;\n');
  spawnSync('git', ['add', '.'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', 'change'], { cwd: root, encoding: 'utf8' });
  const doctor = runCli(['doctor'], root);
  const flagged = /HEAD changed|scan --update/i.test(doctor.out);
  rmSync(root, { recursive: true, force: true });
  console.log(`  recordedHead=${Boolean(meta1.lastScanGitHead)} flaggedAfterCommit=${flagged}`);
  if (!meta1.lastScanGitHead) report.bugsLeft.push('Git HEAD not recorded on scan in this environment');
  return { recordedHead: Boolean(meta1.lastScanGitHead), flagged, doctorOk: doctor.ok || flagged };
}

function sectionPrior() {
  const out = {};
  for (const f of [
    'daily-use-audit-report.json',
    'real-agent-benchmark-report.json',
    'production-readiness-report.json',
    'live-agent-benchmark-report.json',
  ]) {
    const p = join(repo, f);
    if (!existsSync(p)) {
      out[f] = null;
      continue;
    }
    const j = JSON.parse(readFileSync(p, 'utf8'));
    out[f] = {
      present: true,
      summary:
        j.LIVE_AGENT_PROOF ||
        j.liveAgent ||
        j.counts ||
        j.product_impact ||
        j.verdict ||
        Object.keys(j).slice(0, 4),
    };
  }
  return out;
}

function runNode(script) {
  return spawnSync(node, [join(repo, 'scripts', script)], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

async function main() {
  console.log('Building CLI…');
  const build = spawnSync('pnpm', ['--filter', 'neuronai', 'build'], {
    cwd: repo,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (build.status !== 0) {
    console.error(build.stdout, build.stderr);
    process.exit(1);
  }

  console.log('\n=== Live agent infrastructure ===');
  const live = runNode('live-agent-benchmark.mjs');
  console.log(live.stdout.trim());
  report.sections.liveAgent = JSON.parse(
    readFileSync(join(repo, 'live-agent-benchmark-report.json'), 'utf8'),
  );
  report.LIVE_AGENT_PROOF = report.sections.liveAgent.LIVE_AGENT_PROOF;

  console.log('\n=== Daily-use audit (re-run) ===');
  const daily = runNode('daily-use-audit.mjs');
  console.log(
    daily.stdout
      .split('\n')
      .filter((l) => /Counts|CORRECT|Vague|Wrote/.test(l))
      .join('\n'),
  );
  report.sections.dailyUse = JSON.parse(
    readFileSync(join(repo, 'daily-use-audit-report.json'), 'utf8'),
  );

  report.sections.mutation = await sectionMutation();
  report.sections.contextQuality = await sectionContextQuality();
  report.sections.doctorGit = sectionDoctorGit();
  report.sections.prior = sectionPrior();

  if (existsSync(join(repo, 'real-agent-benchmark-report.json'))) {
    const s = JSON.parse(readFileSync(join(repo, 'real-agent-benchmark-report.json'), 'utf8'));
    report.EXPLORATION_POLICY_PROOF = s.product_impact ?? s.final_verdict ?? 'PRESENT';
  }

  const pack = spawnSync(node, [join(repo, 'scripts', 'verify-package.mjs')], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const offline = spawnSync(node, [join(repo, 'scripts', 'verify-offline.mjs')], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  report.sections.packaging = { ok: pack.status === 0, out: (pack.stdout || '').slice(-400) };
  report.sections.offline = { ok: offline.status === 0, out: (offline.stdout || '').slice(-300) };
  if (!report.sections.packaging.ok) report.blockers.push('verify-package failed');
  if (!report.sections.offline.ok) report.blockers.push('verify-offline failed');

  const dailyCounts = report.sections.dailyUse.counts || {};
  const total =
    (dailyCounts.CORRECT || 0) +
    (dailyCounts.ACCEPTABLE || 0) +
    (dailyCounts.WRONG || 0) +
    (dailyCounts.NO_MATCH || 0);
  const good = (dailyCounts.CORRECT || 0) + (dailyCounts.ACCEPTABLE || 0);
  const pct = total ? (good / total) * 100 : 0;
  if ((dailyCounts.WRONG || 0) > 0) report.blockers.push('Daily-use WRONG > 0');
  if (pct < 95) report.blockers.push(`Daily-use correct/acceptable ${pct.toFixed(1)}% < 95%`);

  report.bugsFixed = [
    'Doctor/status record git HEAD at scan and warn when HEAD moves without rescan',
    'Init next-steps explicitly call out MCP reload after upgrade',
    'Live-agent benchmark infrastructure + task suite (honest UNAVAILABLE without inventing traces)',
  ];
  report.bugsLeft = [
    'LIVE_AGENT_PROOF remains UNAVAILABLE until a real multi-turn agent runner is wired',
    '50k-file soak not run this phase (10k proven earlier)',
    'knowledge.json merge-conflict UX still manual for teams',
    ...(report.bugsLeft || []),
  ];

  let verdict = 'READY';
  if (report.blockers.length) verdict = 'NOT READY';
  else if (report.LIVE_AGENT_PROOF === 'UNAVAILABLE' || report.bugsLeft.length) {
    verdict = 'READY WITH CONDITIONS';
  }
  report.verdict = verdict;

  writeFileSync(join(repo, 'p4-validation-report.json'), JSON.stringify(report, null, 2));
  console.log('\nWrote p4-validation-report.json');
  console.log(`VERDICT: ${verdict}`);
  if (report.blockers.length) console.log('Blockers:\n' + report.blockers.map((b) => `  - ${b}`).join('\n'));
  process.exitCode = verdict === 'NOT READY' ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
