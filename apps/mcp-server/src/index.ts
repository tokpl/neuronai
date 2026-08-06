#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMcpRuntime } from './config/runtime.js';
import { createLogger } from './logger.js';
import { createNeuronMcpServer } from './server/create-server.js';

export { createNeuronMcpServer } from './server/create-server.js';
export { createMcpRuntime, type McpRuntime } from './config/runtime.js';
export { TOOL_NAMES } from './tools/register-tools.js';
export { VERSION } from './health.js';

export async function startMcpServer(
  cwd = process.env['NEURON_CWD'] ?? process.cwd(),
): Promise<void> {
  const runtime = await createMcpRuntime(cwd);
  const server = createNeuronMcpServer(runtime);
  await server.connect(new StdioServerTransport());
  runtime.logger.info('Neuron MCP server started (stdio)', {
    project: runtime.neuron.project.name,
  });
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectRun) {
  startMcpServer().catch((error: unknown) => {
    createLogger('stderr').error('Failed to start MCP server', {
      err: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
