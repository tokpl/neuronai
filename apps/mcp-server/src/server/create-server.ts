import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpRuntime } from '../config/runtime.js';
import { VERSION } from '../health.js';
import { registerPrompts } from '../prompts/register-prompts.js';
import { registerResources } from '../resources/register-resources.js';
import { registerTools } from '../tools/register-tools.js';

export function createNeuronMcpServer(runtime: McpRuntime): McpServer {
  const server = new McpServer({ name: 'NeuronAI', version: VERSION });

  registerTools(server, runtime);
  registerResources(server, runtime);
  registerPrompts(server, runtime);

  return server;
}
