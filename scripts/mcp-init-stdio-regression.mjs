#!/usr/bin/env node
/**
 * P0 regression: real neuron init → generated .cursor/mcp.json → same command
 * stdio handshake → tools/list (exactly 7) → neuron_context callable with path + rule.
 *
 * Does NOT mock MCP. Does NOT claim CURSOR_MCP / IDE catalog.
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
const bin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const node = process.execPath;
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const EXPECTED = [
  'neuron_after_task',
  'neuron_context',
  'neuron_remember',
  'neuron_resolve_suggestion',
  'neuron_scan',
  'neuron_search',
  'neuron_update',
].sort();

function write(root, rel, body) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function run(cwd, args) {
  return spawnSync(node, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    timeout: 120_000,
  });
}

async function main() {
  if (!require('node:fs').existsSync(bin)) {
    console.error('FAIL: CLI dist missing — build neuronai first');
    process.exit(1);
  }

  const root = mkdtempSync(join(tmpdir(), 'neuron-mcp-init-'));
  try {
    write(root, 'package.json', JSON.stringify({ name: 'mcp-init-reg', type: 'module', private: true }));
    write(
      root,
      'src/services/payment-service.ts',
      `export class PaymentService { refund(id: string) { return { id, refunded: true }; } }\n`,
    );
    write(
      root,
      'src/api/routes/payments.ts',
      `import { PaymentService } from '../../services/payment-service.js';\nexport const payments = new PaymentService();\n`,
    );

    const init = run(root, ['init', '--yes']);
    if (init.status !== 0) {
      console.error('FAIL: neuron init\n', init.stdout, init.stderr);
      process.exit(1);
    }

    const remember = run(root, [
      'remember',
      'Never call Stripe directly from route handlers. Payment routes must use PaymentService.',
      '--yes',
      '--type',
      'business_rule',
    ]);
    if (remember.status !== 0) {
      console.error('FAIL: neuron remember\n', remember.stdout, remember.stderr);
      process.exit(1);
    }

    const mcpPath = join(root, '.cursor', 'mcp.json');
    const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
    const neuron = mcp.mcpServers?.neuron;
    if (!neuron?.command || !Array.isArray(neuron.args) || !neuron.args.includes('mcp')) {
      console.error('FAIL: generated mcp.json invalid', mcp);
      process.exit(1);
    }
    if (neuron.env?.NEURON_CWD !== root && neuron.env?.NEURON_CWD !== root.replace(/\//g, '\\')) {
      // Windows path normalize
      const a = String(neuron.env?.NEURON_CWD ?? '').replace(/\\/g, '/').toLowerCase();
      const b = root.replace(/\\/g, '/').toLowerCase();
      if (a !== b) {
        console.error('FAIL: NEURON_CWD mismatch', neuron.env?.NEURON_CWD, root);
        process.exit(1);
      }
    }

    const transport = new StdioClientTransport({
      command: neuron.command,
      args: neuron.args,
      env: { ...process.env, ...(neuron.env ?? {}) },
      stderr: 'pipe',
    });
    const client = new Client({ name: 'mcp-init-regression', version: '0.0.0' });
    await client.connect(transport);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    if (JSON.stringify(names) !== JSON.stringify(EXPECTED)) {
      console.error('FAIL: tools/list mismatch', names);
      await client.close().catch(() => {});
      process.exit(1);
    }

    const res = await client.callTool({
      name: 'neuron_context',
      arguments: { task: 'Add a refund endpoint.' },
    });
    const text = res.content?.find((c) => c.type === 'text')?.text ?? '';
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { context: text };
    }
    await client.close().catch(() => {});

    const blob = JSON.stringify(body).toLowerCase();
    const hasPath =
      Boolean(body.recommendation?.path) ||
      /src\/(api|services|payments)/i.test(blob) ||
      (body.relevantFiles ?? []).some((f) => /payment|route/i.test(String(f.path ?? f)));
    const hasRule =
      /stripe|paymentservice|never call stripe/i.test(blob) ||
      (body.relevantRules ?? []).length > 0;

    if (!hasPath) {
      console.error('FAIL: neuron_context returned no project path', body.recommendation, body.relevantFiles);
      process.exit(1);
    }
    if (!hasRule) {
      console.error('FAIL: remembered Stripe/PaymentService rule not present in context', body.relevantRules);
      process.exit(1);
    }

    const report = {
      STDIO_MCP_PROOF: 'PASS',
      CURSOR_MCP_PROOF: 'MANUAL_GATE',
      LIVE_AGENT_PROOF: 'UNAVAILABLE',
      generated_mcp: neuron,
      tools: names,
      recommendation_path: body.recommendation?.path ?? null,
      rules: body.relevantRules?.length ?? 0,
    };
    console.log(JSON.stringify(report, null, 2));
    console.log('PASS: init → mcp.json → stdio tools/list(7) → neuron_context(path+rule)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
