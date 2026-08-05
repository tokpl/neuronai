import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { NeuronRuntime } from '../config/runtime.js';
import {
  handleAfterTask,
  handleGetContext,
  handlePrepareTask,
  handleProjectSummary,
  handleRefreshBrain,
  handleResolveSuggestion,
  handleReviewMemory,
  handleSaveDecision,
  handleScanProject,
  handleSearchMemory,
  handleStoreMemory,
  handleUpdateMemory,
} from '../handlers/index.js';
import { getHealth, VERSION } from '../health.js';
import {
  afterTaskSchema,
  getContextSchema,
  prepareTaskSchema,
  projectSummarySchema,
  resolveSuggestionSchema,
  reviewMemorySchema,
  saveDecisionSchema,
  scanProjectSchema,
  searchMemorySchema,
  storeMemorySchema,
  updateMemorySchema,
} from '../validation/schemas.js';

/** MVP tool set - local project memory for Cursor. Keep this list small. */
export const MVP_TOOL_NAMES = [
  'neuron_health',
  'neuron_prepare_task',
  'neuron_get_context',
  'neuron_search_memory',
  'neuron_save_decision',
  'neuron_store_memory',
  'neuron_update_memory',
  'neuron_review_memory',
  'neuron_after_task',
  'neuron_resolve_suggestion',
  'neuron_scan_project',
  'neuron_refresh_brain',
  'neuron_project_summary',
] as const;

export function registerTools(server: McpServer, runtime: NeuronRuntime): void {
  server.registerTool(
    'neuron_health',
    {
      description: 'Return Neuron MCP server health and version.',
      inputSchema: {},
    },
    async () => {
      const health = getHealth(runtime.config.server.mode);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                ...health,
                version: VERSION,
                privacyMode: runtime.privacyMode,
                tools: MVP_TOOL_NAMES.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'neuron_prepare_task',
    {
      description:
        'Start a coding task with ranked project context (decisions, patterns, warnings). Prefer this before implementing.',
      inputSchema: prepareTaskSchema,
    },
    async (args) => handlePrepareTask(runtime, args),
  );

  server.registerTool(
    'neuron_get_context',
    {
      description:
        'Fetch the most relevant project knowledge for a task (decisions, warnings, related memories).',
      inputSchema: getContextSchema,
    },
    async (args) => handleGetContext(runtime, args),
  );

  server.registerTool(
    'neuron_search_memory',
    {
      description: 'Search project engineering memories (local hybrid search).',
      inputSchema: searchMemorySchema,
    },
    async (args) => handleSearchMemory(runtime, args),
  );

  server.registerTool(
    'neuron_save_decision',
    {
      description: 'Save an architecture or engineering decision to project memory.',
      inputSchema: saveDecisionSchema,
    },
    async (args) => handleSaveDecision(runtime, args),
  );

  server.registerTool(
    'neuron_store_memory',
    {
      description: 'Store a pattern, warning, or other engineering fact in project memory.',
      inputSchema: storeMemorySchema,
    },
    async (args) => handleStoreMemory(runtime, args),
  );

  server.registerTool(
    'neuron_update_memory',
    {
      description: 'Update an existing memory (versioned - never silent overwrite).',
      inputSchema: updateMemorySchema,
    },
    async (args) => handleUpdateMemory(runtime, args),
  );

  server.registerTool(
    'neuron_review_memory',
    {
      description: 'Review prose and suggest whether durable engineering knowledge should be saved.',
      inputSchema: reviewMemorySchema,
    },
    async (args) => handleReviewMemory(runtime, args),
  );

  server.registerTool(
    'neuron_after_task',
    {
      description:
        'After coding: suggest saving knowledge. Prefer Cursor AskQuestion (askQuestion field); fallback typed Save/Edit/Ignore; then neuron_resolve_suggestion.',
      inputSchema: afterTaskSchema,
    },
    async (args) => handleAfterTask(runtime, args),
  );

  server.registerTool(
    'neuron_resolve_suggestion',
    {
      description:
        'Apply the user chat reply to the last neuron_after_task suggestion: action save | edit | ignore. For edit, pass title/content overrides.',
      inputSchema: resolveSuggestionSchema,
    },
    async (args) => handleResolveSuggestion(runtime, args),
  );

  server.registerTool(
    'neuron_scan_project',
    {
      description: 'Scan the codebase and bootstrap / refresh the local project brain under .neuron/.',
      inputSchema: scanProjectSchema,
    },
    async (args) => handleScanProject(runtime, args),
  );

  server.registerTool(
    'neuron_refresh_brain',
    {
      description: 'Refresh the project brain after significant code or structure changes.',
      inputSchema: scanProjectSchema,
    },
    async (args) => handleRefreshBrain(runtime, args),
  );

  server.registerTool(
    'neuron_project_summary',
    {
      description: 'Summarize what Neuron knows about this project (stack, decisions, structure).',
      inputSchema: projectSummarySchema,
    },
    async (args) => handleProjectSummary(runtime, args),
  );
}
