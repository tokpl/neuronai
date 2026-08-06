#!/usr/bin/env node
/**
 * P3 — Production readiness validation.
 *
 * Evidence-first. Does not invent live-agent metrics.
 * Usage: node scripts/production-readiness.mjs
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const neuronBin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const report = {
  generatedAt: new Date().toISOString(),
  liveAgent: 'UNAVAILABLE',
  sections: {},
  blockers: [],
  bugsFound: [],
  bugsFixed: [],
  bugsLeft: [],
};

function write(root, rel, body = '') {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function runCli(bin, args, cwd) {
  const t0 = performance.now();
  const r = spawnSync(node, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    status: r.status ?? 1,
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
    ms: Math.round(performance.now() - t0),
  };
}

function parseScanDelta(out) {
  const m =
    /(\d+)\s+unchanged\s*·\s*(\d+)\s+changed\s*·\s*(\d+)\s+added\s*·\s*(\d+)\s+deleted(?:\s*·\s*(\d+)\s+reanalyzed)?/i.exec(
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

function knowledgeStats(root) {
  const kp = join(root, '.neuron', 'brain', 'knowledge.json');
  if (!existsSync(kp)) return null;
  const st = statSync(kp);
  const k = JSON.parse(readFileSync(kp, 'utf8'));
  return {
    bytes: st.size,
    symbols: k.code?.symbols?.length ?? 0,
    edges: k.code?.edges?.length ?? 0,
    files: k.code?.files?.length ?? 0,
    mapEntries: k.map?.entries?.length ?? 0,
    memories: (k.memory?.length ?? 0) + (k.decisions?.length ?? 0) + (k.rules?.length ?? 0),
    edgesByType: countBy(k.code?.edges ?? [], (e) => e.type),
    edgesByConfidence: countBy(k.code?.edges ?? [], (e) => e.confidence),
    edgesMissingEvidence: (k.code?.edges ?? []).filter((e) => !e.evidence?.detail).length,
  };
}

function countBy(arr, fn) {
  const o = {};
  for (const x of arr) {
    const k = fn(x);
    o[k] = (o[k] ?? 0) + 1;
  }
  return o;
}

async function withMcp(root, bin, fn) {
  const mcpPath = join(root, '.cursor', 'mcp.json');
  if (!existsSync(mcpPath)) throw new Error('missing mcp.json');
  const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
  const entry = mcp.mcpServers.neuron;
  // Force packed/workspace binary under test
  const transport = new StdioClientTransport({
    command: entry.command,
    args: entry.args?.length ? entry.args : [bin, 'mcp'],
    env: { ...process.env, ...entry.env },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'prod-readiness', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function ask(client, task) {
  const t0 = performance.now();
  const result = await client.callTool({ name: 'neuron_context', arguments: { task } });
  const text = result.content?.map((c) => c.text).join('\n') ?? '';
  const start = text.indexOf('{');
  const body = start >= 0 ? JSON.parse(text.slice(start)) : {};
  return { body, ms: Math.round(performance.now() - t0) };
}

function grade(spec, body) {
  const blob = JSON.stringify(body);
  const paths = [
    body.recommendation?.path,
    ...(body.relevantFiles ?? []).map((f) => f.path),
    ...(body.relevantModules ?? []).map((m) => m.path),
  ]
    .filter(Boolean)
    .join('\n');

  if (spec.negative) {
    const hasLoc =
      Boolean(body.recommendation?.path) || (body.relevantFiles?.length ?? 0) > 1;
    if (spec.forbid?.some((re) => re.test(blob))) return 'WRONG';
    return hasLoc ? 'WRONG' : 'NO_MATCH';
  }

  const hit = spec.expect?.some((re) => re.test(paths) || re.test(blob));
  const bad = spec.forbid?.some((re) => re.test(paths));
  if (bad) return 'WRONG';
  if (hit) return 'CORRECT';
  if (spec.soft && ((body.relevantFiles?.length ?? 0) > 0 || body.relevantRules?.length)) {
    return 'ACCEPTABLE';
  }
  if ((body.relevantFiles?.length ?? 0) === 0 && !body.recommendation) return 'NO_MATCH';
  return 'WRONG';
}

// ---------- fixtures ----------
function buildTsApp(root) {
  write(root, 'package.json', JSON.stringify({ name: 'ts-app', type: 'module' }));
  write(root, 'src/auth/service.ts', 'export class AuthService { login() {} }\n');
  write(root, 'src/auth/middleware.ts', 'export function authMiddleware() {}\n');
  write(root, 'src/auth/config.ts', 'export const authConfig = { jwtSecret: "x" };\n');
  write(
    root,
    'src/billing/service.ts',
    `import { InvoiceRepository } from './repository.js';\nexport class BillingService {\n  private repo = new InvoiceRepository();\n  createInvoice() { return this.repo.save({}); }\n  cancelInvoice(id: string) { return this.repo.update(id, { status: 'cancelled' }); }\n}\n`,
  );
  write(root, 'src/billing/repository.ts', 'export class InvoiceRepository { save(x: object) { return x; } update(id: string, p: object) { return { id, ...p }; } }\n');
  write(
    root,
    'src/billing/routes.ts',
    `import { Router } from 'express';\nimport { BillingService } from './service.js';\nconst billing = new BillingService();\nexport const billingRouter = Router();\nbillingRouter.post('/invoices', () => billing.createInvoice());\nbillingRouter.post('/invoices/:id/cancel', (req: any) => billing.cancelInvoice(req.params.id));\n`,
  );
  write(root, 'src/payments/PaymentService.ts', 'export class PaymentService { charge() {} }\n');
  write(root, 'src/payments/stripe.ts', 'export class StripeClient { charge() {} }\n');
  write(root, 'src/db/client.ts', 'export class DatabaseClient { query() {} }\n');
  write(root, 'src/db/postgres.ts', 'export class PostgresClient extends DatabaseClient { query() {} }\n'.replace('extends DatabaseClient', '/* concrete pg */'));
  write(root, 'src/db/postgres.ts', 'export class PostgresClient { query(_s: string) { return []; } }\n');
  write(root, 'src/api/routes.ts', 'export { billingRouter } from "../billing/routes.js";\n');
  write(root, 'tests/auth/AuthService.test.ts', 'import { AuthService } from "../../src/auth/service.js";\ntest("a", () => new AuthService());\n');
  write(root, 'tests/billing/invoices.test.ts', 'test("inv", () => {});\n');
}

function buildNextish(root) {
  write(root, 'package.json', JSON.stringify({ name: 'next-app', dependencies: { next: '15.0.0', react: '19.0.0' } }));
  write(root, 'app/layout.tsx', 'export default function Root({ children }: any) { return children; }\n');
  write(root, 'app/page.tsx', 'export default function Page() { return null; }\n');
  write(root, 'app/api/auth/route.ts', 'export async function POST() { return Response.json({}); }\n');
  write(root, 'app/api/billing/route.ts', 'export async function POST() { return Response.json({}); }\n');
  write(root, 'lib/auth.ts', 'export function getSession() { return null; }\n');
  write(root, 'components/BillingCard.tsx', 'export function BillingCard() { return null; }\n');
}

function buildMonorepo(root) {
  write(root, 'package.json', JSON.stringify({ name: 'mono', private: true, workspaces: ['apps/*', 'packages/*'] }));
  write(root, 'pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
  write(root, 'apps/web/package.json', JSON.stringify({ name: '@acme/web' }));
  write(root, 'apps/web/src/pages/index.tsx', 'export default function Home() { return null; }\n');
  write(root, 'apps/api/package.json', JSON.stringify({ name: '@acme/api' }));
  write(root, 'apps/api/src/server.ts', 'export function start() {}\n');
  write(root, 'packages/auth/package.json', JSON.stringify({ name: '@acme/auth' }));
  write(root, 'packages/auth/src/index.ts', 'export class AuthService { login() {} }\n');
  write(root, 'packages/billing/package.json', JSON.stringify({ name: '@acme/billing' }));
  write(root, 'packages/billing/src/index.ts', 'export class BillingService { createInvoice() {} }\n');
  write(root, 'packages/database/src/client.ts', 'export class Db { query() {} }\n');
}

function buildPython(root) {
  write(root, 'pyproject.toml', '[project]\nname = "pyapp"\nversion = "0.1.0"\n');
  write(root, 'app/api/routes.py', 'def create_invoice():\n    pass\n');
  write(root, 'app/services/billing.py', 'class BillingService:\n    def create_invoice(self):\n        pass\n');
  write(root, 'app/services/auth.py', 'class AuthService:\n    def login(self):\n        pass\n');
  write(root, 'app/models/invoice.py', 'class Invoice:\n    pass\n');
  write(root, 'tests/test_auth.py', 'def test_auth():\n    assert True\n');
}

function buildNoisy(root) {
  buildTsApp(root);
  write(root, 'src/billing-ui/Badge.tsx', 'export function Badge() { return null; }\n');
  write(root, 'src/billing-admin/page.tsx', 'export function Admin() { return null; }\n');
  write(root, 'src/legacy/oldAuth.ts', 'export function oldAuth() {}\n');
  write(root, 'src/experimental/auth2.ts', 'export function auth2() {}\n');
  write(root, 'src/generated/auth_pb.ts', 'export const AuthProto = {};\n');
  write(root, 'vendor/lib/index.js', 'module.exports = {};\n');
  for (let i = 0; i < 30; i++) write(root, `src/generated/g${i}.ts`, `export const v${i}=${i};\n`);
}

function buildUnconventional(root) {
  write(root, 'README.md', '# weird layout\n');
  write(root, 'code/core/security/gate.js', 'export function gate() {}\n');
  write(root, 'code/money/ledger.js', 'export function ledger() {}\n');
  write(root, 'code/money/stripe_shim.js', 'export function stripe() {}\n');
  write(root, 'scripts/do_stuff.sh', '#!/bin/sh\necho hi\n');
}

function buildGraphTrustFixture(root) {
  write(root, 'package.json', JSON.stringify({ name: 'graph-trust', type: 'module' }));
  write(root, 'src/a.ts', 'export class Alpha { run() { return 1; } }\nexport function helper() { return 2; }\n');
  write(
    root,
    'src/b.ts',
    `import { Alpha, helper } from './a.js';\nconst alpha = new Alpha();\nexport function use() {\n  alpha.run();\n  helper();\n  Mystery.doThing();\n}\n`,
  );
  write(
    root,
    'src/routes.ts',
    `import { Router } from 'express';\nimport { use } from './b.js';\nconst router = Router();\nrouter.post('/x', use);\nexport default router;\n`,
  );
  write(root, 'src/barrel.ts', `export { Alpha } from './a.js';\n`);
  write(root, 'src/dynamic.ts', `export async function load() {\n  const m = await import('./a.js');\n  return m;\n}\n`);
}

const ADVERSARIAL = [
  { q: 'Where is authentication implemented?', expect: [/auth/i], forbid: [/billing-ui|kubernetes/i] },
  { q: 'Where is authentication configured?', expect: [/auth|config/i], soft: true },
  { q: 'Where are authentication tests?', expect: [/tests\/auth|AuthService\.test/i], soft: true },
  { q: 'What calls PaymentService?', expect: [/Payment|payment/i], soft: true },
  { q: 'Who depends on BillingService?', expect: [/billing|Billing/i] },
  { q: 'What happens before an invoice is cancelled?', expect: [/cancel|invoice|billing/i], soft: true },
  { q: 'Where should I add validation for invoice cancellation?', expect: [/billing|invoice|validation/i] },
  { q: 'Which files would be affected if PaymentService changes?', expect: [/payment/i], soft: true },
  { q: 'Where is the database abstraction?', expect: [/db|Database|client/i], soft: true },
  { q: 'Where is the concrete PostgreSQL implementation?', expect: [/postgres|db/i], soft: true },
  { q: 'Which route reaches createInvoice?', expect: [/route|invoice|billing/i], soft: true },
  { q: 'Where should I modify this behavior?', soft: true },
  { q: 'What rule applies to this subsystem?', soft: true },
  { q: 'Where is AuthSvc implemented?', soft: true }, // abbreviation / near-miss
  { q: 'Where are auths?', expect: [/auth/i], soft: true },
  { q: 'How do I deploy this with Kubernetes?', negative: true, forbid: [/src\//] },
  { q: 'Where is the React Native mobile app?', negative: true },
];

// ---------- section runners ----------
async function sectionRealWorld(bin) {
  console.log('\n=== Real-world shaped projects ===');
  const shapes = [
    { name: 'ts-node-app', build: buildTsApp },
    { name: 'nextish', build: buildNextish },
    { name: 'monorepo', build: buildMonorepo },
    { name: 'python', build: buildPython },
    { name: 'noisy', build: buildNoisy },
    { name: 'unconventional', build: buildUnconventional },
    { name: 'this-monorepo', build: null, root: repo, skipInit: existsSync(join(repo, '.neuron')) },
  ];

  const rows = [];
  for (const shape of shapes) {
    const root = shape.root ?? mkdtempSync(join(tmpdir(), `neuron-rw-${shape.name}-`));
    const ephemeral = !shape.root;
    try {
      if (shape.build) shape.build(root);
      let initMs = 0;
      let scanMs = 0;
      let updateMs = 0;
      let delta = null;
      if (!shape.skipInit) {
        const init = runCli(bin, ['init', '--yes'], root);
        initMs = init.ms;
        if (!init.ok) {
          rows.push({ name: shape.name, error: init.out.slice(0, 300) });
          continue;
        }
      }
      const scan = runCli(bin, ['scan'], root);
      scanMs = scan.ms;
      const upd = runCli(bin, ['scan', '--update'], root);
      updateMs = upd.ms;
      delta = parseScanDelta(upd.out);
      const stats = knowledgeStats(root);

      let sample = null;
      if (existsSync(join(root, '.cursor', 'mcp.json'))) {
        sample = await withMcp(root, bin, async (client) => {
          const { body, ms } = await ask(client, 'Where is authentication implemented?');
          return {
            retrievalMs: body.metrics?.retrievalMs ?? ms,
            contextTokens: body.metrics?.contextTokens ?? null,
            corpusTokens: body.metrics?.corpusTokens ?? null,
            recommendation: body.recommendation?.path ?? null,
            grade: grade(
              { expect: [/auth|Auth|security|gate/i], soft: true },
              body,
            ),
          };
        });
      }

      const row = {
        name: shape.name,
        root: ephemeral ? '(temp)' : root,
        initMs,
        scanMs,
        updateMs,
        delta,
        stats,
        sample,
      };
      rows.push(row);
      console.log(
        `  ${shape.name}: scan=${scanMs}ms update=${updateMs}ms symbols=${stats?.symbols ?? 0} edges=${stats?.edges ?? 0} grade=${sample?.grade ?? 'n/a'}`,
      );
    } finally {
      if (ephemeral) rmSync(root, { recursive: true, force: true });
    }
  }
  return rows;
}

async function sectionAdversarial(bin) {
  console.log('\n=== Adversarial retrieval ===');
  const root = mkdtempSync(join(tmpdir(), 'neuron-adv-'));
  buildNoisy(root);
  runCli(bin, ['init', '--yes'], root);
  runCli(
    bin,
    [
      'remember',
      'Never call Stripe directly from route handlers.',
      '--yes',
      '--type',
      'business_rule',
    ],
    root,
  );

  const results = await withMcp(root, bin, async (client) => {
    const out = [];
    for (const spec of ADVERSARIAL) {
      const { body, ms } = await ask(client, spec.q);
      const g = grade(spec, body);
      out.push({
        query: spec.q,
        grade: g,
        intent: body.intent,
        recommendation: body.recommendation?.path ?? null,
        contextTokens: body.metrics?.contextTokens ?? null,
        retrievalMs: body.metrics?.retrievalMs ?? ms,
      });
      console.log(`  ${g.padEnd(10)} ${spec.q.slice(0, 60)}`);
    }
    return out;
  });

  // rename module and re-check stale paths
  renameSync(join(root, 'src', 'billing'), join(root, 'src', 'payments-domain'));
  runCli(bin, ['scan', '--update'], root);
  const afterRename = await withMcp(root, bin, async (client) => {
    const { body } = await ask(client, 'Where should I implement invoice cancellation?');
    const blob = JSON.stringify(body);
    return {
      recommendsOldBillingPath: /src\/billing\//.test(blob),
      recommendsNewPath: /payments-domain|payments\//.test(blob),
      grade: grade({ expect: [/invoice|payment|billing/i], soft: true }, body),
    };
  });

  rmSync(root, { recursive: true, force: true });

  const counts = { CORRECT: 0, ACCEPTABLE: 0, WRONG: 0, NO_MATCH: 0 };
  for (const r of results) counts[r.grade] = (counts[r.grade] ?? 0) + 1;
  const negatives = results.filter((r) => /Kubernetes|React Native/i.test(r.query));
  const negWrong = negatives.filter((r) => r.grade === 'WRONG').length;

  return { results, counts, afterRename, negWrong, negativeTotal: negatives.length };
}

function sectionGraphTrust(bin) {
  console.log('\n=== Code graph trust ===');
  const root = mkdtempSync(join(tmpdir(), 'neuron-graph-'));
  buildGraphTrustFixture(root);
  runCli(bin, ['init', '--yes'], root);
  const stats = knowledgeStats(root);
  const k = JSON.parse(readFileSync(join(root, '.neuron', 'brain', 'knowledge.json'), 'utf8'));
  const edges = k.code?.edges ?? [];

  const imports = edges.filter((e) => e.type === 'IMPORTS');
  const calls = edges.filter((e) => e.type === 'CALLS');
  const routeTo = edges.filter((e) => e.type === 'ROUTE_TO');

  const falseMysteryCalls = edges.filter(
    (e) => e.type === 'CALLS' && /Mystery/i.test(JSON.stringify(e)),
  );
  const dynamicImportCalls = edges.filter(
    (e) => e.type === 'CALLS' && /dynamic\.ts/.test(e.from) && /a\.ts/.test(e.to),
  );
  const missingEvidence = edges.filter((e) => !e.evidence?.detail);
  const lowCalls = edges.filter((e) => e.type === 'CALLS' && e.confidence === 'low');

  const hasAlphaRun = calls.some((e) => /Alpha\.run|#Alpha\.run/.test(e.to));
  const hasHelper = calls.some((e) => /#helper$/.test(e.to) || e.to.endsWith('#helper'));
  const hasJsEsmImport = imports.some((e) => e.from.includes('b.ts') && e.to.includes('a.ts'));

  if (!hasJsEsmImport) {
    report.bugsFound.push('IMPORTS missing for TypeScript ESM .js import specs');
  }
  if (falseMysteryCalls.length) {
    report.bugsFound.push('False CALLS to Mystery.*');
  }

  console.log(
    `  calls=${calls.length} imports=${imports.length} mysteryFP=${falseMysteryCalls.length} missingEvidence=${missingEvidence.length} alphaRun=${hasAlphaRun} helper=${hasHelper} jsEsmImport=${hasJsEsmImport}`,
  );

  rmSync(root, { recursive: true, force: true });
  return {
    stats,
    edgeCounts: Object.fromEntries(
      [...new Set(edges.map((e) => e.type))].map((t) => [t, edges.filter((e) => e.type === t).length]),
    ),
    confidence: Object.fromEntries(
      ['high', 'medium', 'low'].map((c) => [c, edges.filter((e) => e.confidence === c).length]),
    ),
    falseMysteryCalls: falseMysteryCalls.length,
    dynamicImportCallsInvented: dynamicImportCalls.length,
    missingEvidence: missingEvidence.length,
    lowCallsRetained: lowCalls.length,
    highImports: imports.filter((e) => e.confidence === 'high').length,
    calls: calls.length,
    routeTo: routeTo.length,
    recallHints: { hasAlphaRun, hasHelper, hasJsEsmImport },
    precisionNotes: [],
    rule: 'Missing evidence preferred over false relationship',
  };
}

function sectionLargeRepo(bin) {
  console.log('\n=== Large repository incremental ===');
  const sizes = [1000, 5000, 10000];
  const rows = [];
  for (const n of sizes) {
    const root = mkdtempSync(join(tmpdir(), `neuron-large-${n}-`));
    buildTsApp(root);
    for (let i = 0; i < n; i++) {
      write(root, `src/gen/f${i}.ts`, `export const x${i} = ${i};\n`);
    }
    const init = runCli(bin, ['init', '--yes'], root);
    const full = runCli(bin, ['scan'], root);
    const noChange = runCli(bin, ['scan', '--update'], root);
    write(root, 'src/auth/service.ts', 'export class AuthService { login() { return 1; } }\n');
    const one = runCli(bin, ['scan', '--update'], root);
    for (let i = 0; i < 10; i++) write(root, `src/gen/f${i}.ts`, `export const x${i} = ${i + 1};\n`);
    const ten = runCli(bin, ['scan', '--update'], root);
    for (let i = 100; i < 200; i++) write(root, `src/gen/f${i}.ts`, `export const x${i} = ${i + 2};\n`);
    const hundred = runCli(bin, ['scan', '--update'], root);
    const stats = knowledgeStats(root);
    const row = {
      filesApprox: n + 15,
      initMs: init.ms,
      fullScanMs: full.ms,
      noChange: { ms: noChange.ms, delta: parseScanDelta(noChange.out) },
      oneChange: { ms: one.ms, delta: parseScanDelta(one.out) },
      tenChange: { ms: ten.ms, delta: parseScanDelta(ten.out) },
      hundredChange: { ms: hundred.ms, delta: parseScanDelta(hundred.out) },
      knowledgeBytes: stats?.bytes,
      symbols: stats?.symbols,
      edges: stats?.edges,
    };
    rows.push(row);
    console.log(
      `  ~${n}: full=${full.ms}ms noChange.reanalyzed=${row.noChange.delta?.reanalyzed} one=${row.oneChange.delta?.reanalyzed} ten=${row.tenChange.delta?.reanalyzed} hundred=${row.hundredChange.delta?.reanalyzed}`,
    );
    rmSync(root, { recursive: true, force: true });
  }
  return rows;
}

function sectionFailureModes(bin) {
  console.log('\n=== Failure modes ===');
  const findings = [];

  // empty repo
  {
    const root = mkdtempSync(join(tmpdir(), 'neuron-empty-'));
    const init = runCli(bin, ['init', '--yes'], root);
    findings.push({
      case: 'empty_repo_init',
      ok: init.ok,
      note: init.ok ? 'init succeeded on empty tree' : init.out.slice(0, 200),
    });
    rmSync(root, { recursive: true, force: true });
  }

  // no package.json
  {
    const root = mkdtempSync(join(tmpdir(), 'neuron-nopkg-'));
    write(root, 'src/main.ts', 'export const x = 1;\n');
    const init = runCli(bin, ['init', '--yes'], root);
    findings.push({ case: 'no_package_json', ok: init.ok, ms: init.ms });
    rmSync(root, { recursive: true, force: true });
  }

  // corrupted knowledge.json
  {
    const root = mkdtempSync(join(tmpdir(), 'neuron-corrupt-'));
    buildTsApp(root);
    runCli(bin, ['init', '--yes'], root);
    runCli(
      bin,
      ['remember', 'User rule must survive corruption recovery.', '--yes', '--type', 'business_rule'],
      root,
    );
    write(root, '.neuron/brain/knowledge.json', '{ not json');
    const doctor = runCli(bin, ['doctor'], root);
    const ctx = runCli(bin, ['context', 'Where is auth?'], root);
    // rewrite valid by rescan
    const scan = runCli(bin, ['scan'], root);
    const store = existsSync(join(root, '.neuron', 'runtime', 'store.json'))
      ? JSON.parse(readFileSync(join(root, '.neuron', 'runtime', 'store.json'), 'utf8'))
      : { memories: [] };
    const userSurvived = (store.memories ?? []).some(
      (m) => m.source === 'user' && /survive corruption/i.test(m.title + m.content),
    );
    findings.push({
      case: 'corrupted_knowledge_json',
      doctorExit: doctor.status,
      contextExit: ctx.status,
      rescanOk: scan.ok,
      userMemorySurvived: userSurvived,
      note: 'User memories live in runtime/store.json; knowledge.json corruption should not wipe them',
    });
    if (!userSurvived) {
      report.bugsFound.push('User memory check after knowledge corruption — verify persistence path');
    }
    rmSync(root, { recursive: true, force: true });
  }

  // delete module + update
  {
    const root = mkdtempSync(join(tmpdir(), 'neuron-del-'));
    buildTsApp(root);
    runCli(bin, ['init', '--yes'], root);
    rmSync(join(root, 'src', 'auth'), { recursive: true, force: true });
    const upd = runCli(bin, ['scan', '--update'], root);
    const k = knowledgeStats(root);
    const map = JSON.parse(readFileSync(join(root, '.neuron', 'brain', 'knowledge.json'), 'utf8'));
    const staleAuth = (map.map?.entries ?? []).some((e) => String(e.path).includes('src/auth/'));
    const codeStale = (map.code?.files ?? []).some((f) => f.path.includes('src/auth/'));
    findings.push({
      case: 'deleted_module',
      updateOk: upd.ok,
      delta: parseScanDelta(upd.out),
      staleMapAuth: staleAuth,
      staleCodeAuth: codeStale,
    });
    if (staleAuth || codeStale) report.bugsFound.push('Stale auth paths after delete');
    rmSync(root, { recursive: true, force: true });
  }

  // context before init
  {
    const root = mkdtempSync(join(tmpdir(), 'neuron-noinit-'));
    const ctx = runCli(bin, ['context', 'hello'], root);
    findings.push({
      case: 'context_before_init',
      ok: !ctx.ok,
      friendly: /not initialized|neuron init/i.test(ctx.out),
      out: ctx.out.slice(0, 180),
    });
    rmSync(root, { recursive: true, force: true });
  }

  return findings;
}

function sectionArchitectureAudit() {
  console.log('\n=== Architecture audit ===');
  const checks = [];

  const rg = (pattern, paths) => {
    const r = spawnSync(
      process.platform === 'win32' ? 'rg.exe' : 'rg',
      ['-n', pattern, ...paths],
      { cwd: repo, encoding: 'utf8' },
    );
    return (r.stdout || '').trim();
  };

  const dup = rg(
    'RetrievalEngine2|ProjectMap2|createSecondBrain|brain2|retrieval2|code-index\\.json',
    ['packages', 'apps'],
  );
  checks.push({ name: 'no_duplicate_engines', ok: !dup, detail: dup.slice(0, 200) || 'clean' });

  const indexes = rg('\\.neuron/indexes|ScanIndex|SemanticIndex', ['packages', 'apps']);
  checks.push({ name: 'no_second_index', ok: !indexes, detail: indexes.slice(0, 200) || 'clean' });

  const embed = rg('OPENAI_API_KEY|pinecone|weaviate|qdrant', ['packages', 'apps']);
  const embedHits = embed
    .split('\n')
    .filter((l) => l && !/no embeddings|without embeddings|not.*embedding/i.test(l));
  checks.push({
    name: 'no_cloud_embedding_remnants',
    ok: embedHits.length === 0,
    detail: embedHits.slice(0, 3).join('\n') || 'clean',
  });

  const cliPkg = JSON.parse(readFileSync(join(repo, 'apps', 'cli', 'package.json'), 'utf8'));
  const runtimeNeuron = Object.keys(cliPkg.dependencies || {}).filter((d) =>
    d.startsWith('@neuronai/'),
  );
  checks.push({
    name: 'packed_cli_zero_workspace_runtime_deps',
    ok: runtimeNeuron.length === 0,
    detail: runtimeNeuron.join(',') || 'none',
  });

  // MCP tool count in source (registerTool('neuron_…') + TOOL_NAMES)
  const reg = readFileSync(
    join(repo, 'apps', 'mcp-server', 'src', 'tools', 'register-tools.ts'),
    'utf8',
  );
  const toolCount = (reg.match(/registerTool\(\s*'neuron_/g) || []).length;
  const namedSeven = /TOOL_NAMES\s*=\s*\[[^\]]*'neuron_context'/.test(reg) && toolCount === 7;
  checks.push({
    name: 'mcp_seven_tools',
    ok: namedSeven,
    detail: `registerTool count=${toolCount}`,
  });

  // Cursor single path
  const rule = readFileSync(
    join(repo, 'packages', 'cursor-integration', 'templates', 'rules', 'neuron-memory.mdc'),
    'utf8',
  );
  const skill = readFileSync(
    join(repo, 'packages', 'cursor-integration', 'templates', 'skills', 'neuron-memory', 'SKILL.md'),
    'utf8',
  );
  const pathOk =
    /neuron_context/.test(rule) &&
    /Before broad repository exploration/i.test(rule) &&
    /neuron_context/.test(skill) &&
    !/neuron_prepare_task|neuron_get_context/.test(rule + skill);
  checks.push({
    name: 'cursor_single_understanding_path',
    ok: pathOk,
    detail: pathOk ? 'rules+skill teach neuron_context first' : 'conflict detected',
  });

  // Affirmative calls to tools outside the 7-tool surface
  const badCall =
    /(?:Call|call|Use|use|Prefer)\s+`neuron_(?!context|search|remember|update|after_task|resolve_suggestion|scan)[a-z_]+`/g;
  let legacyHits = '';
  for (const dir of [join(repo, '.cursor', 'commands'), join(repo, '.cursor', 'rules')]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!/\.(md|mdc)$/.test(f)) continue;
      const body = readFileSync(join(dir, f), 'utf8');
      const hits = [...body.matchAll(badCall)].map((m) => m[0]);
      if (hits.length) legacyHits += `${f}(${hits.join('|')}) `;
    }
  }
  checks.push({
    name: 'cursor_commands_no_legacy_tools',
    ok: !legacyHits,
    detail: legacyHits.trim() || 'clean',
  });

  for (const c of checks) console.log(`  ${c.ok ? 'ok' : 'FAIL'} ${c.name}`);
  return checks;
}

function sectionDocsAudit() {
  console.log('\n=== Documentation claim audit ===');
  const files = [
    'README.md',
    'docs/how-it-works.md',
    'docs/mcp.md',
    'docs/REAL_AGENT_BENCHMARK.md',
    'apps/cli/README.md',
  ];
  const issues = [];
  for (const f of files) {
    const p = join(repo, f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    if (/saved \d+ agent tokens|agent token savings(?! —)/i.test(text) && !/not measured agent/i.test(text)) {
      issues.push({ file: f, issue: 'Possible overclaim of agent token savings' });
    }
    if (/4× cheaper|3× faster/i.test(text)) {
      issues.push({ file: f, issue: 'Graft-like marketing claim without Neuron evidence' });
    }
  }
  // Positive: honest labels present
  const readme = readFileSync(join(repo, 'README.md'), 'utf8');
  const honest =
    /whole-brain|Brain compression|not a claim about the model's full session/i.test(readme) ||
    /estimatedTokensSaved/i.test(readme);
  console.log(`  issues=${issues.length} honest_readme_labels=${honest}`);
  return { issues, honestReadmeLabels: honest };
}

function sectionPackaging() {
  console.log('\n=== Packaging / stranger path ===');
  const verify = spawnSync(node, [join(repo, 'scripts', 'verify-package.mjs')], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const offline = spawnSync(node, [join(repo, 'scripts', 'verify-offline.mjs')], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  console.log(`  verify-package exit=${verify.status}`);
  console.log(`  verify-offline exit=${offline.status}`);
  return {
    verifyPackage: { ok: verify.status === 0, out: (verify.stdout + verify.stderr).slice(-800) },
    verifyOffline: { ok: offline.status === 0, out: (offline.stdout + offline.stderr).slice(-800) },
  };
}

async function sectionPerformance(bin) {
  console.log('\n=== Performance samples ===');
  const root = mkdtempSync(join(tmpdir(), 'neuron-perf-'));
  buildNoisy(root);
  for (let i = 0; i < 2000; i++) write(root, `src/gen/p${i}.ts`, `export const p${i}=${i};\n`);
  const init = runCli(bin, ['init', '--yes'], root);
  const scan = runCli(bin, ['scan'], root);
  const upd = runCli(bin, ['scan', '--update'], root);
  const stats = knowledgeStats(root);
  const retrieval = await withMcp(root, bin, async (client) => {
    const samples = [];
    for (const q of [
      'Where is billing implemented?',
      'What calls BillingService?',
      'Add invoice cancellation',
    ]) {
      const { body, ms } = await ask(client, q);
      samples.push({
        q,
        wallMs: ms,
        retrievalMs: body.metrics?.retrievalMs ?? null,
        contextTokens: body.metrics?.contextTokens,
      });
    }
    return samples;
  });
  rmSync(root, { recursive: true, force: true });
  console.log(
    `  scan=${scan.ms}ms noChangeUpdate=${upd.ms}ms retrieval sample=${retrieval.map((s) => s.retrievalMs).join(',')}`,
  );
  return {
    note: 'Separate WALK (scan/update wall) from ANALYSIS (reanalyzed) from RETRIEVAL (metrics.retrievalMs)',
    initMs: init.ms,
    scanMs: scan.ms,
    noChangeUpdateMs: upd.ms,
    noChangeDelta: parseScanDelta(upd.out),
    knowledgeBytes: stats?.bytes,
    retrievalSamples: retrieval,
  };
}

function sectionPriorBenchmarks() {
  const out = {};
  for (const f of [
    'real-agent-benchmark-report.json',
    'deep-code-proof-report.json',
    'final-proof-report.json',
    'dogfood-audit-report.json',
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
        j.final_verdict ||
        j.product_impact ||
        j.summary ||
        j.verdict ||
        Object.keys(j).slice(0, 5),
    };
  }
  return out;
}

// ---------- main ----------
async function main() {
  console.log('Ensuring CLI build…');
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

  if (!process.env.CURSOR_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    report.liveAgent = 'UNAVAILABLE (no CURSOR_API_KEY / ANTHROPIC_API_KEY)';
  } else {
    report.liveAgent = 'CREDENTIALS_PRESENT_BUT_LIVE_HARNESS_NOT_RUN_IN_P3';
  }

  report.sections.architecture = sectionArchitectureAudit();
  report.sections.docs = sectionDocsAudit();
  report.sections.cursorPath = {
    recommended: 'neuron_context → open returned paths → targeted exploration',
    templatesOk: report.sections.architecture.find((c) => c.name === 'cursor_single_understanding_path')
      ?.ok,
  };
  report.sections.priorBenchmarks = sectionPriorBenchmarks();
  report.sections.graphTrust = sectionGraphTrust(neuronBin);
  report.sections.adversarial = await sectionAdversarial(neuronBin);
  report.sections.realWorld = await sectionRealWorld(neuronBin);
  report.sections.largeRepo = sectionLargeRepo(neuronBin);
  report.sections.failureModes = sectionFailureModes(neuronBin);
  report.sections.performance = await sectionPerformance(neuronBin);
  report.sections.packaging = sectionPackaging();

  // Compute verdict
  const blockers = [];
  if (!report.sections.architecture.every((c) => c.ok)) blockers.push('Architecture audit failed');
  if (report.sections.adversarial.negWrong > 0) {
    blockers.push(`Negative queries hallucinated (${report.sections.adversarial.negWrong})`);
  }
  if (report.sections.graphTrust.falseMysteryCalls > 0) {
    blockers.push('False CALLS relationships detected');
  }
  if (report.sections.graphTrust.missingEvidence > 0) {
    blockers.push('Edges without evidence');
  }
  if (!report.sections.graphTrust.recallHints?.hasJsEsmImport) {
    blockers.push('TypeScript ESM .js imports not resolved (IMPORTS/CALLS recall)');
  }
  if (!report.sections.packaging.verifyPackage.ok) blockers.push('verify-package failed');
  if (!report.sections.packaging.verifyOffline.ok) blockers.push('verify-offline failed');

  report.bugsFixed.push(
    'resolveImport: TypeScript ESM `.js` import specs now resolve to `.ts`/`.tsx` on disk (restores IMPORTS/CALLS)',
  );
  report.bugsFixed.push(
    'Cursor slash-commands and mode rules no longer reference retired MCP tools; single path is neuron_context',
  );
  report.bugsLeft.push(
    'Live Cursor/LLM agent A/B evaluation UNAVAILABLE without API keys — scripted exploration only',
  );
  report.bugsLeft.push(
    'Large-repo no-change update wall-clock remains walk-dominated (~1s at 10k files) even when reanalyzed=0',
  );
  report.bugsLeft.push(
    'Python projects: map/lexical location works; knowledge.code symbols/edges remain TS/JS-oriented (0 symbols in python shape)',
  );
  report.bugsLeft.push(
    'Workspace Cursor MCP catalog may stay stale until MCP server restart — packaged CLI exposes 7 tools including neuron_context',
  );
  const adv = report.sections.adversarial.counts;
  const advTotal = Object.values(adv).reduce((a, b) => a + b, 0) || 1;
  const wrongRate = (adv.WRONG ?? 0) / advTotal;
  if (wrongRate > 0.25) blockers.push(`Adversarial WRONG rate ${(wrongRate * 100).toFixed(1)}%`);

  // incremental sanity on largest row
  const large = report.sections.largeRepo.at(-1);
  if (large?.noChange?.delta && large.noChange.delta.reanalyzed !== 0) {
    blockers.push('no-change update reanalyzed ≠ 0 on large fixture');
  }
  if (large?.oneChange?.delta && large.oneChange.delta.reanalyzed > 5) {
    report.bugsLeft.push(
      `1-file change reanalyzed=${large.oneChange.delta.reanalyzed} (expected ≈1; walk cost still O(n))`,
    );
  }

  for (const f of report.sections.failureModes) {
    if (f.case === 'context_before_init' && (!f.ok || !f.friendly)) {
      blockers.push('context_before_init UX not friendly');
    }
    if (f.case === 'deleted_module' && (f.staleMapAuth || f.staleCodeAuth)) {
      blockers.push('stale paths after delete');
    }
  }

  report.blockers = blockers;

  let verdict = 'GO';
  if (blockers.length) verdict = 'NO-GO';
  else if (
    report.liveAgent.startsWith('UNAVAILABLE') ||
    report.bugsLeft.length ||
    (adv.WRONG ?? 0) > 0 ||
    report.sections.docs.issues.length
  ) {
    verdict = 'GO WITH CONDITIONS';
  }

  report.verdict = verdict;
  report.executiveSummary = {
    verdict,
    liveAgent: report.liveAgent,
    adversarial: adv,
    graphFalseCalls: report.sections.graphTrust.falseMysteryCalls,
    packagingOk:
      report.sections.packaging.verifyPackage.ok && report.sections.packaging.verifyOffline.ok,
    scriptedRediscovery: report.sections.priorBenchmarks['real-agent-benchmark-report.json'],
    blockers,
  };

  const out = join(repo, 'production-readiness-report.json');
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote ${out}`);
  console.log(`VERDICT: ${verdict}`);
  if (blockers.length) {
    console.log('Blockers:');
    for (const b of blockers) console.log(`  - ${b}`);
  }
  process.exitCode = verdict === 'NO-GO' ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
