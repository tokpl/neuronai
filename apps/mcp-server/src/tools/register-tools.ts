import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpRuntime } from '../config/runtime.js';
import {
  handleAfterTask,
  handleContext,
  handleRemember,
  handleResolveClarify,
  handleResolveSuggestion,
  handleScan,
  handleSearch,
  handleUpdate,
  handleWorkflow,
} from '../handlers/index.js';
import {
  afterTaskSchema,
  contextSchema,
  rememberSchema,
  resolveClarifySchema,
  resolveSuggestionSchema,
  scanSchema,
  searchSchema,
  updateSchema,
  workflowSchema,
} from '../validation/schemas.js';

/**
 * MCP tools — keep descriptions short (agent context cost).
 */
export const TOOL_NAMES = [
  'neuron_context',
  'neuron_search',
  'neuron_remember',
  'neuron_update',
  'neuron_after_task',
  'neuron_resolve_suggestion',
  'neuron_resolve_clarify',
  'neuron_workflow',
  'neuron_scan',
] as const;

export function registerTools(server: McpServer, runtime: McpRuntime): void {
  server.registerTool(
    'neuron_context',
    {
      description:
        'Call FIRST before exploring. Returns paths/rules + present.callFirst/clarify/gate. If clarify/gate set: AskQuestion then neuron_resolve_clarify. Append contribution.summary. After durable work: neuron_after_task.',
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
        'After coding, propose or autosave durable knowledge. Follow present; then neuron_resolve_suggestion when AskQuestion. Autosave never cancels contribution.summary.',
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
    'neuron_resolve_clarify',
    {
      description:
        'Persist the user answer to a neuron_context clarify question (questionId + optionId or freeText). Clears gate when all answers stored.',
      inputSchema: resolveClarifySchema,
    },
    async (args) => handleResolveClarify(runtime, args),
  );

  server.registerTool(
    'neuron_workflow',
    {
      description:
        'Deliver board (.neuron/workflow/): get_board | set_board | clear_board | propose_waves | complete_checklist. propose_waves needs resolvable seedPath when code intel exists; optional runbook feature|incident|enterprise-change|feedback (feedback = stack-agnostic bug list with screenshot evidence + ask-user). complete_checklist requires checklistDone (+ notes; feedback needs existing evidence PNG paths).',
      inputSchema: workflowSchema,
    },
    async (args) => handleWorkflow(runtime, args),
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
