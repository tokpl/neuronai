import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpRuntime } from '../config/runtime.js';
import {
  handleAfterTask,
  handleContext,
  handleRemember,
  handleResolveSuggestion,
  handleScan,
  handleSearch,
  handleUpdate,
} from '../handlers/index.js';
import {
  afterTaskSchema,
  contextSchema,
  rememberSchema,
  resolveSuggestionSchema,
  scanSchema,
  searchSchema,
  updateSchema,
} from '../validation/schemas.js';

/**
 * Seven tools, one job each. Descriptions are context the agent pays for on
 * every turn, so they stay one line.
 */
export const TOOL_NAMES = [
  'neuron_context',
  'neuron_search',
  'neuron_remember',
  'neuron_update',
  'neuron_after_task',
  'neuron_resolve_suggestion',
  'neuron_scan',
] as const;

export function registerTools(server: McpServer, runtime: McpRuntime): void {
  server.registerTool(
    'neuron_context',
    {
      description:
        'Before exploring the repository: return where to look (modules, files, symbols), rules and memories. Call first. After the turn, append contribution.summary to the user reply (see present.footer). After durable coding, call neuron_after_task (afterCoding).',
      inputSchema: contextSchema,
    },
    async (args) => handleContext(runtime, args),
  );

  server.registerTool(
    'neuron_search',
    {
      description: 'Search project memories by keyword or phrase.',
      inputSchema: searchSchema,
    },
    async (args) => handleSearch(runtime, args),
  );

  server.registerTool(
    'neuron_remember',
    {
      description: 'Store a decision, pattern, warning or fact. Duplicates are merged, not added.',
      inputSchema: rememberSchema,
    },
    async (args) => handleRemember(runtime, args),
  );

  server.registerTool(
    'neuron_update',
    {
      description: 'Update an existing memory. Versioned — the old content is kept.',
      inputSchema: updateSchema,
    },
    async (args) => handleUpdate(runtime, args),
  );

  server.registerTool(
    'neuron_after_task',
    {
      description:
        'After coding, propose durable knowledge. If suggest=true: when AskQuestion is available, call it with question.title/prompt/options (prompt already shows the proposed memory). Do not paste Yes/Edit/No as chat markdown. Then neuron_resolve_suggestion. Nothing is saved until they answer.',
      inputSchema: afterTaskSchema,
    },
    async (args) => handleAfterTask(runtime, args),
  );

  server.registerTool(
    'neuron_resolve_suggestion',
    {
      description: 'Apply the user answer to the last neuron_after_task draft.',
      inputSchema: resolveSuggestionSchema,
    },
    async (args) => handleResolveSuggestion(runtime, args),
  );

  server.registerTool(
    'neuron_scan',
    {
      description: 'Rescan the codebase and refresh the project brain.',
      inputSchema: scanSchema,
    },
    async (args) => handleScan(runtime, args),
  );
}
