#!/usr/bin/env node
/**
 * Live Cursor MCP A/B validation harness helpers.
 *
 * Does NOT invent traces. Does NOT treat CLI `neuron context` as MCP_PROOF.
 * After Cursor MCP is live with NEURON_CWD → fixture, use this to:
 *   - print acceptance checklist
 *   - emit empty metric scaffold for scored Task transcripts
 *
 * Usage:
 *   node scripts/live-agent-mcp-validation.mjs
 *   node scripts/live-agent-mcp-validation.mjs --status
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(repo, 'live-agent-mcp-report.json');
const fixture = join(repo, '.tmp', 'live-mcp-ab-fixture');
const mcpJson = join(repo, '.cursor', 'mcp.json');
const bin = join(repo, 'apps', 'cli', 'dist', 'index.js');

const TASKS = [
  'Where is authentication implemented?',
  'Where are API routes defined?',
  'Where is billing implemented?',
  'Where is the Stripe integration?',
  'Where should I add a new payment endpoint?',
  'Add support for cancelling invoices.',
  'Add a refund endpoint.',
  'Fix an authentication-expiry bug.',
  'Fix duplicate payment webhooks.',
  'Add retry handling to PaymentService.',
  'Modify database access for payments.',
  'Add a background payment reconciliation job.',
  'Where are tests for invoices?',
  'What rule applies when modifying payment routes?',
  'What architecture decision affects payments?',
  'What calls PaymentService?',
  'What depends on the Stripe client?',
  'Where should invoice cancellation start?',
  'Refactor payment persistence.',
  'How should I configure Kubernetes autoscaling?',
];

function status() {
  const mcp = existsSync(mcpJson)
    ? JSON.parse(readFileSync(mcpJson, 'utf8').replace(/^\uFEFF/, ''))
    : null;
  const cwd = mcp?.mcpServers?.neuron?.env?.NEURON_CWD ?? null;
  const fixtureOk = existsSync(join(fixture, '.neuron', 'brain', 'knowledge.json'));
  let cliContextOk = false;
  let cliSnippet = '';
  if (fixtureOk) {
    const r = spawnSync(process.execPath, [bin, 'context', 'Where is billing implemented?'], {
      env: { ...process.env, NEURON_CWD: fixture },
      encoding: 'utf8',
      cwd: fixture,
    });
    cliSnippet = (r.stdout || r.stderr || '').slice(0, 800);
    cliContextOk =
      /payment-service|payments\.ts|Never call Stripe/i.test(cliSnippet) && r.status === 0;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    fixturePath: fixture,
    fixtureBrainPresent: fixtureOk,
    mcpJsonCwd: cwd,
    mcpJsonPointsAtFixture: cwd === fixture || cwd?.replace(/\\/g, '/') === fixture.replace(/\\/g, '/'),
    STDIO_FIXTURE_CONTEXT: cliContextOk ? 'PASS' : 'FAIL',
    MCP_PROOF: 'MANUAL — run GetMcpTools + CallMcpTool(neuron_context) in Cursor chat',
    LIVE_AGENT_PROOF: 'NOT_RUN_UNTIL_MCP_PROOF_PASS',
    tasks: TASKS.length,
    acceptanceBeforeBenchmark: [
      'GetMcpTools lists neuron server',
      'exactly 7 product tools including neuron_context',
      'CallMcpTool neuron_context returns fixture Recommended start + Stripe rule',
      'then 20×A + 20×B with hard transcript scoring',
    ],
    cliSnippetPreview: cliSnippet.slice(0, 400),
  };

  console.log(JSON.stringify(out, null, 2));
  if (existsSync(reportPath)) {
    console.error(`\nExisting report: ${reportPath}`);
    const rep = JSON.parse(readFileSync(reportPath, 'utf8'));
    console.error(`labels: ${JSON.stringify(rep.labels)}`);
  }
}

const arg = process.argv[2] ?? '--status';
if (arg === '--status' || arg === undefined) status();
else {
  console.error('Usage: node scripts/live-agent-mcp-validation.mjs [--status]');
  process.exit(1);
}
