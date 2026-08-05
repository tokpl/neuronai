#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createNeuronRuntime } from './config/runtime.js';
import { logger } from './health.js';
import { createNeuronMcpServer } from './server/create-server.js';

export { createNeuronMcpServer } from './server/create-server.js';
export { createNeuronRuntime } from './config/runtime.js';
export {
  handleGetContext,
  handleSearchMemory,
  handleSaveDecision,
  handleStoreMemory,
  handleReviewMemory,
  handleUpdateMemory,
  handleProjectSummary,
} from './handlers/index.js';

export async function startMcpServer(cwd = process.env['NEURON_CWD'] ?? process.cwd()): Promise<void> {
  // Any accidental createLogger() without destination must not touch stdout
  process.env['NEURON_MCP_STDIO'] = '1';

  const runtime = await createNeuronRuntime(cwd);
  const server = createNeuronMcpServer(runtime);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  runtime.logger.info(
    {
      project: runtime.project.name,
      projectId: runtime.project.projectId,
      mode: runtime.config.server.mode,
    },
    'Neuron MCP server started (stdio)',
  );
}

async function main(): Promise<void> {
  await startMcpServer();
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectRun) {
  main().catch((error: unknown) => {
    logger.error({ err: error }, 'Failed to start MCP server');
    process.exitCode = 1;
  });
}
