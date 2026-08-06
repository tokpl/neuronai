import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regression: production MCP entry must expose exactly the 7-tool surface
 * and neuron_context must be callable. Protects the Cursor upgrade failure mode
 * where IDE catalogs go stale — binary correctness is still gated here.
 */
describe('MCP stdio product surface', () => {
  it('lists exactly 7 tools and neuron_context is callable', async () => {
    const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..');
    const require = createRequire(join(repo, 'apps', 'cli', 'package.json'));
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

    const bin = join(repo, 'apps', 'cli', 'dist', 'index.js');
    const expected = [
      'neuron_after_task',
      'neuron_context',
      'neuron_remember',
      'neuron_resolve_suggestion',
      'neuron_scan',
      'neuron_search',
      'neuron_update',
    ].sort();

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bin, 'mcp'],
      env: { ...process.env, NEURON_CWD: repo },
      stderr: 'pipe',
    });
    const client = new Client({ name: 'mcp-surface-test', version: '0.0.0' });
    await client.connect(transport);
    try {
      const listed = await client.listTools();
      const names = listed.tools.map((t) => t.name).sort();
      expect(names).toEqual(expected);

      const res = await client.callTool({
        name: 'neuron_context',
        arguments: { task: 'Where should I start for payments?' },
      });
      const text = res.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
      expect(text.length).toBeGreaterThan(10);
      // Must not be a transport/tool-not-found failure
      expect(text).not.toMatch(/-32602|Tool not found/i);
    } finally {
      await client.close().catch(() => {});
    }
  }, 30_000);
});
