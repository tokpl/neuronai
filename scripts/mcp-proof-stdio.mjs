#!/usr/bin/env node
/**
 * P0 Cursor MCP integration — stdio baseline against a fixture or cwd.
 * Guarantees: tools/list has exactly the 7 product tools + neuron_context callable.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

export const EXPECTED_TOOLS = [
  'neuron_context',
  'neuron_search',
  'neuron_remember',
  'neuron_update',
  'neuron_after_task',
  'neuron_resolve_suggestion',
  'neuron_scan',
];

const fixture = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : join(repo, '.tmp', 'mcp-proof');
const bin = join(repo, 'apps', 'cli', 'dist', 'index.js');
const outPath = join(repo, '.tmp', 'mcp-proof-stdio-report.json');

async function main() {
  if (!existsSync(bin)) {
    console.error('CLI dist missing — build neuronai first');
    process.exit(1);
  }
  if (!existsSync(fixture)) {
    console.error('Fixture missing:', fixture);
    process.exit(1);
  }

  const mcpJsonPath = join(fixture, '.cursor', 'mcp.json');
  const mcpJson = existsSync(mcpJsonPath)
    ? JSON.parse(readFileSync(mcpJsonPath, 'utf8'))
    : null;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bin, 'mcp'],
    env: { ...process.env, NEURON_CWD: fixture },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'mcp-proof-stdio', version: '0.0.0' });
  await client.connect(transport);

  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name).sort();
  const expected = [...EXPECTED_TOOLS].sort();
  const hasContext = names.includes('neuron_context');
  const exactSeven =
    names.length === expected.length && names.every((n, i) => n === expected[i]);

  let callOk = false;
  let callError = null;
  let sample = null;
  try {
    const res = await client.callTool({
      name: 'neuron_context',
      arguments: { task: 'Where is the payment implementation?' },
    });
    const text = res.content?.find((c) => c.type === 'text')?.text ?? '';
    sample = JSON.parse(text);
    callOk = Boolean(sample?.recommendation?.path || sample?.context || sample?.relevantFiles);
  } catch (e) {
    callError = String(e?.message || e);
  }

  await client.close().catch(() => {});

  const report = {
    generatedAt: new Date().toISOString(),
    STDIO_MCP: exactSeven && hasContext && callOk ? 'PASS' : 'FAIL',
    fixture,
    mcpJson,
    tools_list: names,
    expected_tools: expected,
    exact_seven_product_tools: exactSeven,
    neuron_context_present: hasContext,
    neuron_context_callable: callOk,
    call_error: callError,
    recommendation_path: sample?.recommendation?.path ?? null,
    rules_count: sample?.relevantRules?.length ?? null,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.STDIO_MCP === 'PASS' ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
