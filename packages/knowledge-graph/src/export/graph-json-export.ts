import type { GraphEdge } from '../domain/entities/graph-edge.js';
import type { GraphNode } from '../domain/entities/graph-node.js';

/**
 * Visualization-ready JSON (dashboard / VS Code / web later - no UI in this milestone).
 */
export interface GraphJsonExport {
  version: 1;
  projectId: string;
  name: string;
  generatedAt: string;
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    path?: string;
    metadata: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    type: string;
    metadata: Record<string, unknown>;
  }>;
}

export function exportGraphJson(
  nodes: GraphNode[],
  edges: GraphEdge[],
  meta: { projectId: string; name: string },
): GraphJsonExport {
  return {
    version: 1,
    projectId: meta.projectId,
    name: meta.name,
    generatedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      path: n.path,
      metadata: n.metadata,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.fromNodeId,
      to: e.toNodeId,
      type: e.relationType,
      metadata: e.metadata,
    })),
  };
}
