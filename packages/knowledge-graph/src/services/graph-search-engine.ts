import type { GraphEdge, GraphRelationType } from '../domain/entities/graph-edge.js';
import type { GraphNode } from '../domain/entities/graph-node.js';
import type { GraphRepository } from '../repositories/graph-repository.js';

export interface GraphNeighborHit {
  node: GraphNode;
  edge: GraphEdge;
  depth: number;
}

export interface ImpactPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Graph traversal: neighbors, dependency trees, impact paths, related memories.
 */
export class GraphSearchEngine {
  constructor(private readonly graph: GraphRepository) {}

  async neighbors(
    projectId: string,
    nodeId: string,
    options: {
      depth?: number;
      direction?: 'out' | 'in' | 'both';
      relationTypes?: GraphRelationType[];
    } = {},
  ): Promise<GraphNeighborHit[]> {
    const depth = options.depth ?? 1;
    const direction = options.direction ?? 'both';
    const results: GraphNeighborHit[] = [];
    const visited = new Set<string>([nodeId]);
    let frontier = [nodeId];

    for (let d = 1; d <= depth; d++) {
      const nextFrontier: string[] = [];
      for (const current of frontier) {
        const out =
          direction === 'in'
            ? []
            : await this.graph.findEdges({ projectId, fromNodeId: current });
        const inn =
          direction === 'out'
            ? []
            : await this.graph.findEdges({ projectId, toNodeId: current });

        for (const edge of [...out, ...inn]) {
          if (options.relationTypes && !options.relationTypes.includes(edge.relationType)) {
            continue;
          }
          const otherId = edge.fromNodeId === current ? edge.toNodeId : edge.fromNodeId;
          if (visited.has(otherId)) continue;
          visited.add(otherId);
          const node = await this.graph.getNode(otherId);
          if (!node) continue;
          results.push({ node, edge, depth: d });
          nextFrontier.push(otherId);
        }
      }
      frontier = nextFrontier;
    }

    return results;
  }

  async dependencyTree(
    projectId: string,
    nodeId: string,
    depth = 3,
  ): Promise<GraphNeighborHit[]> {
    return this.neighbors(projectId, nodeId, {
      depth,
      direction: 'out',
      relationTypes: ['DEPENDS_ON', 'IMPORTS', 'USES'],
    });
  }

  async relatedMemories(projectId: string, nodeId: string): Promise<GraphNode[]> {
    const hits = await this.neighbors(projectId, nodeId, {
      depth: 2,
      relationTypes: ['RELATED_TO', 'AFFECTS'],
    });
    return hits.filter((h) => h.node.type === 'MEMORY').map((h) => h.node);
  }

  async impactPaths(
    projectId: string,
    fromNodeId: string,
    maxDepth = 4,
  ): Promise<ImpactPath[]> {
    const paths: ImpactPath[] = [];
    const start = await this.graph.getNode(fromNodeId);
    if (!start) return paths;

    const walk = async (
      currentId: string,
      nodes: GraphNode[],
      edges: GraphEdge[],
      depth: number,
    ): Promise<void> => {
      if (depth >= maxDepth) return;
      const outgoing = await this.graph.findEdges({
        projectId,
        fromNodeId: currentId,
      });
      const relevant = outgoing.filter((e) =>
        ['DEPENDS_ON', 'IMPORTS', 'USES', 'AFFECTS', 'CALLS'].includes(e.relationType),
      );
      // Also who depends on me (reverse impact)
      const incoming = (
        await this.graph.findEdges({ projectId, toNodeId: currentId })
      ).filter((e) => ['DEPENDS_ON', 'IMPORTS', 'USES', 'AFFECTS'].includes(e.relationType));

      for (const edge of [...relevant, ...incoming]) {
        const nextId = edge.fromNodeId === currentId ? edge.toNodeId : edge.fromNodeId;
        if (nodes.some((n) => n.id === nextId)) continue;
        const next = await this.graph.getNode(nextId);
        if (!next) continue;
        const nextNodes = [...nodes, next];
        const nextEdges = [...edges, edge];
        if (nextNodes.length > 1) {
          paths.push({ nodes: nextNodes, edges: nextEdges });
        }
        await walk(nextId, nextNodes, nextEdges, depth + 1);
      }
    };

    await walk(fromNodeId, [start], [], 0);
    return paths.slice(0, 100);
  }
}

export function createGraphSearchEngine(graph: GraphRepository): GraphSearchEngine {
  return new GraphSearchEngine(graph);
}
