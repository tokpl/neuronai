import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { NeuronRuntime } from '../config/runtime.js';

export function registerPrompts(server: McpServer, runtime: NeuronRuntime): void {
  server.registerPrompt(
    'neuron_before_coding',
    {
      description: 'Prepare the agent with Neuron context before implementation.',
      argsSchema: {
        task: z.string(),
      },
    },
    async ({ task }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Before implementing, load project memory from Neuron.',
              `Project: ${runtime.project.name}`,
              `Task: ${task}`,
              '1. Call neuron_prepare_task (or neuron_get_context) with this task.',
              '2. Respect architecture decisions and known warnings.',
              '3. Do not reinvent patterns that already exist in Neuron.',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'neuron_after_coding',
    {
      description: 'Review whether new knowledge should be saved to Neuron after coding.',
      argsSchema: {
        summary: z.string(),
      },
    },
    async ({ summary }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'After finishing the implementation, review whether Neuron should remember something.',
              `Summary of work: ${summary}`,
              '1. Call neuron_after_task or neuron_review_memory with the summary',
              '2. If shouldSave is true, call neuron_save_decision or neuron_store_memory',
              '3. Avoid duplicates - search first',
            ].join('\n'),
          },
        },
      ],
    }),
  );
}
