import type { MemoryRecord } from '@neuronai/types';

import { createGraphEdge } from '../domain/entities/graph-edge.js';
import { createGraphNode, type GraphNode } from '../domain/entities/graph-node.js';
import type { GraphRepository } from '../repositories/graph-repository.js';

/**
 * Links Memory Engine records into the knowledge graph as MEMORY nodes.
 */
export class MemoryGraphLinker {
  constructor(private readonly graph: GraphRepository) {}

  async linkMemories(projectId: string, memories: MemoryRecord[]): Promise<GraphNode[]> {
    const created: GraphNode[] = [];
    const modules = await this.graph.findNodes({ projectId, type: 'MODULE' });
    const services = await this.graph.findNodes({ projectId, type: 'SERVICE' });
    const files = await this.graph.findNodes({ projectId, type: 'FILE' });

    for (const memory of memories) {
      if (memory.status !== 'active') continue;
      const node = createGraphNode({
        id: `n-memory-${memory.id}`,
        projectId,
        type: 'MEMORY',
        name: memory.title,
        metadata: {
          memoryId: memory.id,
          memoryType: memory.type,
          importance: memory.importanceScore,
          tags: memory.tags,
        },
      });
      await this.graph.upsertNode(node);
      created.push(node);

      const hay = `${memory.title}\n${memory.content}\n${memory.tags.join(' ')}`.toLowerCase();
      const candidates = [...modules, ...services, ...files];
      for (const target of candidates) {
        const tokens = target.name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
        const hit = tokens.some((t) => hay.includes(t)) || (target.path && hay.includes(target.path.toLowerCase()));
        if (!hit) continue;
        await this.graph.upsertEdge(
          createGraphEdge({
            projectId,
            fromNodeId: node.id,
            toNodeId: target.id,
            relationType: 'RELATED_TO',
            metadata: { memoryId: memory.id },
          }),
        );
      }
    }

    return created;
  }

  async memoriesForNode(projectId: string, nodeId: string): Promise<GraphNode[]> {
    const edges = await this.graph.findEdges({
      projectId,
      toNodeId: nodeId,
      relationType: 'RELATED_TO',
    });
    const out: GraphNode[] = [];
    for (const edge of edges) {
      const node = await this.graph.getNode(edge.fromNodeId);
      if (node?.type === 'MEMORY') out.push(node);
    }
    return out;
  }
}

export function createMemoryGraphLinker(graph: GraphRepository): MemoryGraphLinker {
  return new MemoryGraphLinker(graph);
}
