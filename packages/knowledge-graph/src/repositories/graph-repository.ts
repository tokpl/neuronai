import type { GraphChangeRecord } from '../domain/entities/graph-change.js';
import type { GraphEdge } from '../domain/entities/graph-edge.js';
import type { GraphNode, GraphNodeType } from '../domain/entities/graph-node.js';
import type { GraphRelationType } from '../domain/entities/graph-edge.js';

/**
 * Storage abstraction for the project knowledge graph.
 *
 * MVP: InMemory / JSON file (local-first, zero ops).
 * Future: Postgres adjacency tables (same interface) or Neo4j adapter.
 */
export interface GraphRepository {
  upsertNode(node: GraphNode): Promise<GraphNode>;
  getNode(id: string): Promise<GraphNode | null>;
  findNodes(filter: {
    projectId: string;
    type?: GraphNodeType;
    name?: string;
    path?: string;
  }): Promise<GraphNode[]>;
  removeNode(id: string): Promise<void>;

  upsertEdge(edge: GraphEdge): Promise<GraphEdge>;
  getEdge(id: string): Promise<GraphEdge | null>;
  findEdges(filter: {
    projectId: string;
    fromNodeId?: string;
    toNodeId?: string;
    relationType?: GraphRelationType;
  }): Promise<GraphEdge[]>;
  removeEdge(id: string): Promise<void>;

  appendChange(change: GraphChangeRecord): Promise<void>;
  listChanges(projectId: string, limit?: number): Promise<GraphChangeRecord[]>;

  /** Full project subgraph for export / reload */
  exportProject(projectId: string): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    changes: GraphChangeRecord[];
  }>;

  importProject(snapshot: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    changes?: GraphChangeRecord[];
  }): Promise<void>;
}
