import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { NeuronRuntime } from '../config/runtime.js';

export function registerPrompts(server: McpServer, runtime: NeuronRuntime): void {
  server.registerPrompt(
    'neuron_analyze_project',
    {
      description: 'Analyze the current project and prepare Neuron context.',
      argsSchema: {
        focus: z.string().optional(),
      },
    },
    async ({ focus }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Use Neuron AI Memory to analyze this project before coding.',
              `Project: ${runtime.project.name} (${runtime.project.stack.join(', ') || 'unknown stack'})`,
              focus ? `Focus: ${focus}` : undefined,
              '1. Call neuron_project_summary',
              '2. Call neuron_get_context with a short analysis task',
              '3. Summarize architecture, risks, and what to remember',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
      ],
    }),
  );

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
              `Task: ${task}`,
              'Call neuron_get_context with this task.',
              'Respect architecture decisions and known mistakes.',
              'Do not reinvent patterns that already exist in Neuron.',
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
              '1. Call neuron_review_memory with the summary',
              '2. If shouldSave is true, call neuron_save_decision or neuron_store_memory',
              '3. Avoid duplicates',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'neuron_architecture_review',
    {
      description: 'Run an architecture review using Neuron decisions and patterns.',
      argsSchema: {
        area: z.string().optional(),
      },
    },
    async ({ area }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Perform an architecture review with Neuron AI Memory.',
              area ? `Area: ${area}` : 'Area: whole project',
              'Call neuron_architecture_review (and optionally neuron_architecture_scan).',
              'Read neuron://project/architecture and neuron://project/decisions.',
              'Report issues, risks, recommendations — do not auto-rewrite code.',
            ].join('\n'),
          },
        },
      ],
    }),
  );
}
