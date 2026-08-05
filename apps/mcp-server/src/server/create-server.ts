import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { NeuronRuntime } from '../config/runtime.js';
import { VERSION } from '../health.js';
import { registerPrompts } from '../prompts/register-prompts.js';
import { registerResources } from '../resources/register-resources.js';
import { registerTools } from '../tools/register-tools.js';

export function createNeuronMcpServer(runtime: NeuronRuntime): McpServer {
  const server = new McpServer({
    name: 'neuronai',
    version: VERSION,
  });

  registerTools(server, runtime);
  registerResources(server, runtime);
  registerPrompts(server, runtime);

  return server;
}
