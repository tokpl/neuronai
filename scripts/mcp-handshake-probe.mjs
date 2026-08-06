/**
 * Connect to the same MCP entry Cursor would use and prove:
 *   initialize → tools/list → neuron_context
 * against the production Project Brain path.
 *
 * Usage: node scripts/mcp-handshake-probe.mjs <project-root>
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(repoRoot, 'apps', 'cli', 'package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const root = process.argv[2];
if (!root) {
  console.error('Usage: node scripts/mcp-handshake-probe.mjs <project-root>');
  process.exit(2);
}

const mcpPath = join(root, '.cursor', 'mcp.json');
if (!existsSync(mcpPath)) {
  console.error(`Missing ${mcpPath}`);
  process.exit(1);
}

const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
const entry = mcp.mcpServers?.neuron;
if (!entry?.command) {
  console.error('No mcpServers.neuron in config');
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: entry.command,
  args: entry.args ?? [],
  env: { ...process.env, ...(entry.env ?? {}) },
  stderr: 'pipe',
});

const client = new Client({ name: 'neuron-handshake-probe', version: '0.0.0' });
await client.connect(transport);

const listed = await client.listTools();
const names = listed.tools.map((t) => t.name).sort();

const expected = [
  'neuron_after_task',
  'neuron_context',
  'neuron_remember',
  'neuron_resolve_suggestion',
  'neuron_scan',
  'neuron_search',
  'neuron_update',
].sort();

const legacy = names.filter((n) =>
  /prepare_task|get_context|search_memory|scan_project|store_memory|save_decision|project_summary|refresh_brain/.test(
    n,
  ),
);

const started = Date.now();
const result = await client.callTool({
  name: 'neuron_context',
  arguments: {
    task: 'Where is billing implemented and what rule should I follow when modifying it?',
  },
});
const latencyMs = Date.now() - started;

const text = Array.isArray(result.content)
  ? result.content.map((c) => ('text' in c ? c.text : '')).join('')
  : '';
let body;
try {
  body = JSON.parse(text);
} catch {
  body = { raw: text };
}

const report = {
  mcpEntry: { command: entry.command, args: entry.args, env: entry.env },
  tools: names,
  expectedMatch: JSON.stringify(names) === JSON.stringify(expected),
  legacyTools: legacy,
  latencyMs,
  neuron_context: body,
};

const outPath = join(root, '.neuron', 'mcp-handshake-probe.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));

await client.close();

const contextOk =
  body?.ok === true &&
  typeof body.context === 'string' &&
  /billing|stripe/i.test(
    [
      body.context,
      JSON.stringify(body.relevantFiles ?? []),
      JSON.stringify(body.relevantModules ?? []),
      JSON.stringify(body.relevantRules ?? []),
    ].join('\n'),
  ) &&
  body.metrics?.contextTokens <= body.metrics?.budgetTokens &&
  !/importanceScore|taskRelevance|rankingScore/.test(body.context ?? '') &&
  !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(body.context ?? '');

const fail =
  !names.includes('neuron_context') ||
  legacy.length > 0 ||
  !report.expectedMatch ||
  !contextOk;

if (!contextOk) console.error('neuron_context response failed product checks');
process.exit(fail ? 1 : 0);
