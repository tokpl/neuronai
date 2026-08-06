import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { McpRuntime } from '../config/runtime.js';

export function registerPrompts(server: McpServer, runtime: McpRuntime): void {
  server.registerPrompt(
    'neuron_before_coding',
    {
      description: 'Load project context before implementing.',
      argsSchema: { task: z.string() },
    },
    async ({ task }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Project: ${runtime.neuron.project.name}`,
              `Task: ${task}`,
              'Call neuron_context with this task before exploring the repository.',
              'Prefer the modules, files, symbols and rules it returns; open those paths next.',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'neuron_after_coding',
    {
      description: 'Decide whether anything is worth remembering after coding.',
      argsSchema: { summary: z.string() },
    },
    async ({ summary }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Work completed: ${summary}`,
              'Call neuron_after_task. If it proposes a draft, ask the user Yes / Edit / No,',
              'then call neuron_resolve_suggestion with their answer.',
            ].join('\n'),
          },
        },
      ],
    }),
  );
}
