import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { NeuronRuntime } from '../config/runtime.js';

async function memoriesByType(runtime: NeuronRuntime, type: string) {
  const ctx = await runtime.engine.getProjectMemoryContext({
    projectId: runtime.project.projectId,
    limit: 100,
    maxTokens: 20_000,
  });
  return ctx.memories.filter((m) => m.type === type);
}

export function registerResources(server: McpServer, runtime: NeuronRuntime): void {
  server.registerResource(
    'project-context',
    'neuron://project/context',
    {
      description: 'Current high-signal project context for coding agents',
      mimeType: 'application/json',
    },
    async () => {
      const summary = await runtime.engine.getProjectMemoryContext({
        projectId: runtime.project.projectId,
        limit: 30,
        maxTokens: runtime.config.memory.contextMaxTokens,
      });
      return {
        contents: [
          {
            uri: 'neuron://project/context',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                project: runtime.project,
                memories: summary.memories,
                warnings: summary.warnings,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    'project-architecture',
    'neuron://project/architecture',
    {
      description: 'Architecture decisions and dependency notes',
      mimeType: 'application/json',
    },
    async () => {
      const decisions = await memoriesByType(runtime, 'architecture_decision');
      const deps = await memoriesByType(runtime, 'dependency');
      return {
        contents: [
          {
            uri: 'neuron://project/architecture',
            mimeType: 'application/json',
            text: JSON.stringify({ decisions, dependencies: deps }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'project-decisions',
    'neuron://project/decisions',
    { description: 'Active architecture decisions', mimeType: 'application/json' },
    async () => ({
      contents: [
        {
          uri: 'neuron://project/decisions',
          mimeType: 'application/json',
          text: JSON.stringify(await memoriesByType(runtime, 'architecture_decision'), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'project-patterns',
    'neuron://project/patterns',
    { description: 'Active coding patterns and conventions', mimeType: 'application/json' },
    async () => ({
      contents: [
        {
          uri: 'neuron://project/patterns',
          mimeType: 'application/json',
          text: JSON.stringify(await memoriesByType(runtime, 'pattern'), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'project-mistakes',
    'neuron://project/mistakes',
    { description: 'Known footguns and mistakes to avoid', mimeType: 'application/json' },
    async () => ({
      contents: [
        {
          uri: 'neuron://project/mistakes',
          mimeType: 'application/json',
          text: JSON.stringify(await memoriesByType(runtime, 'mistake'), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'agent-context',
    'neuron://agent/context',
    {
      description: 'Last prepared agent context from neuron_prepare_task',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'neuron://agent/context',
          mimeType: 'application/json',
          text: JSON.stringify(
            runtime.intelligence.session.lastContext ?? {
              note: 'Call neuron_prepare_task first',
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    'agent-recommendations',
    'neuron://agent/recommendations',
    {
      description: 'Current recommendations for the agent session',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'neuron://agent/recommendations',
          mimeType: 'application/json',
          text: JSON.stringify(
            runtime.intelligence.session.lastRecommendations ?? { items: [] },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    'agent-risks',
    'neuron://agent/risks',
    {
      description: 'Latest change-risk reports for the agent session',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'neuron://agent/risks',
          mimeType: 'application/json',
          text: JSON.stringify(runtime.intelligence.session.lastRisks ?? [], null, 2),
        },
      ],
    }),
  );
}
