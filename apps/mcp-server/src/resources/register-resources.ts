import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpRuntime } from '../config/runtime.js';

/**
 * One browsable resource: what the brain durably knows.
 * Task-scoped retrieval belongs to neuron_context, not here.
 */
export function registerResources(server: McpServer, runtime: McpRuntime): void {
  server.registerResource(
    'project-brain',
    'neuron://project/brain',
    {
      description: 'What Neuron knows about this project: stack, decisions, rules, health',
      mimeType: 'application/json',
    },
    async () => {
      const { brain, project } = runtime.neuron;
      return {
        contents: [
          {
            uri: 'neuron://project/brain',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                project: { name: project.name, stack: project.stack },
                status: brain.status(),
                decisions: brain.knowledge.decisions.map((d) => ({
                  title: d.title,
                  content: d.content,
                })),
                rules: brain.knowledge.rules.map((r) => ({ title: r.title, body: r.body })),
                modules: brain.dna.structure.modules?.value ?? [],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
