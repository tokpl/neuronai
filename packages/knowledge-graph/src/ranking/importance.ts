import type { GraphNode } from '../domain/entities/graph-node.js';
import type { GraphRepository } from '../repositories/graph-repository.js';
import { createIndexedGraphCache } from '../storage/indexed-cache.js';

export interface NodeImportanceScore {
  nodeId: string;
  name: string;
  type: string;
  score: number;
  factors: {
    connections: number;
    usage: number;
    recentChanges: number;
    businessImportance: number;
  };
}

/**
 * Rank nodes by usage, degree, freshness, and business weight.
 */
export class NodeImportanceScorer {
  constructor(private readonly graph: GraphRepository) {}

  async scoreProject(projectId: string, limit = 50): Promise<NodeImportanceScore[]> {
    const cache = await createIndexedGraphCache(this.graph).build(projectId);
    const changes = await this.graph.listChanges(projectId, 200);
    const recentIds = new Set(changes.map((c) => c.entityId).filter(Boolean));

    const scores: NodeImportanceScore[] = [];
    for (const node of cache.nodes) {
      const degree = cache.degree(node.id);
      const connections = Math.min(1, degree / 20);
      const usage = usageFactor(node);
      const recentChanges = recentIds.has(node.id) ? 0.85 : 0.25;
      const businessImportance = businessWeight(node);
      const score =
        Math.round(
          (connections * 0.3 + usage * 0.2 + recentChanges * 0.2 + businessImportance * 0.3) *
            1000,
        ) / 1000;

      scores.push({
        nodeId: node.id,
        name: node.name,
        type: node.type,
        score,
        factors: { connections, usage, recentChanges, businessImportance },
      });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

function usageFactor(node: GraphNode): number {
  const u = node.metadata['usageCount'];
  if (typeof u === 'number') return Math.min(1, u / 50);
  if (node.type === 'API_ENDPOINT' || node.type === 'SERVICE') return 0.7;
  if (node.type === 'MODULE') return 0.55;
  return 0.35;
}

function businessWeight(node: GraphNode): number {
  const name = node.name.toLowerCase();
  if (/auth|payment|billing|permission|security/.test(name)) return 0.95;
  if (node.type === 'DECISION' || node.type === 'RULE') return 0.8;
  if (node.type === 'INCIDENT' || node.type === 'THREAT') return 0.85;
  if (node.type === 'DATABASE_TABLE') return 0.75;
  if (typeof node.metadata['businessImportance'] === 'number') {
    return Math.min(1, Number(node.metadata['businessImportance']));
  }
  return 0.4;
}

export function createNodeImportanceScorer(graph: GraphRepository): NodeImportanceScorer {
  return new NodeImportanceScorer(graph);
}
