import type { GraphChangeRecord } from '../domain/entities/graph-change.js';
import type { GraphEdge, GraphRelationType } from '../domain/entities/graph-edge.js';
import type { GraphNode, GraphNodeType } from '../domain/entities/graph-node.js';
import type { GraphRepository } from './graph-repository.js';

export class InMemoryGraphRepository implements GraphRepository {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges = new Map<string, GraphEdge>();
  private readonly changes: GraphChangeRecord[] = [];

  async upsertNode(node: GraphNode): Promise<GraphNode> {
    const existing = this.nodes.get(node.id);
    const next = existing
      ? { ...node, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
      : node;
    this.nodes.set(next.id, next);
    return next;
  }

  async getNode(id: string): Promise<GraphNode | null> {
    return this.nodes.get(id) ?? null;
  }

  async findNodes(filter: {
    projectId: string;
    type?: GraphNodeType;
    name?: string;
    path?: string;
  }): Promise<GraphNode[]> {
    return [...this.nodes.values()].filter((n) => {
      if (n.projectId !== filter.projectId) return false;
      if (filter.type && n.type !== filter.type) return false;
      if (filter.name && n.name.toLowerCase() !== filter.name.toLowerCase()) return false;
      if (filter.path && n.path !== filter.path) return false;
      return true;
    });
  }

  async removeNode(id: string): Promise<void> {
    this.nodes.delete(id);
    for (const [edgeId, edge] of this.edges) {
      if (edge.fromNodeId === id || edge.toNodeId === id) this.edges.delete(edgeId);
    }
  }

  async upsertEdge(edge: GraphEdge): Promise<GraphEdge> {
    // Deduplicate by endpoints + relation
    for (const existing of this.edges.values()) {
      if (
        existing.projectId === edge.projectId &&
        existing.fromNodeId === edge.fromNodeId &&
        existing.toNodeId === edge.toNodeId &&
        existing.relationType === edge.relationType
      ) {
        const next = {
          ...existing,
          metadata: { ...existing.metadata, ...edge.metadata },
          updatedAt: new Date().toISOString(),
        };
        this.edges.set(existing.id, next);
        return next;
      }
    }
    this.edges.set(edge.id, edge);
    return edge;
  }

  async getEdge(id: string): Promise<GraphEdge | null> {
    return this.edges.get(id) ?? null;
  }

  async findEdges(filter: {
    projectId: string;
    fromNodeId?: string;
    toNodeId?: string;
    relationType?: GraphRelationType;
  }): Promise<GraphEdge[]> {
    return [...this.edges.values()].filter((e) => {
      if (e.projectId !== filter.projectId) return false;
      if (filter.fromNodeId && e.fromNodeId !== filter.fromNodeId) return false;
      if (filter.toNodeId && e.toNodeId !== filter.toNodeId) return false;
      if (filter.relationType && e.relationType !== filter.relationType) return false;
      return true;
    });
  }

  async removeEdge(id: string): Promise<void> {
    this.edges.delete(id);
  }

  async appendChange(change: GraphChangeRecord): Promise<void> {
    this.changes.push(change);
    if (this.changes.length > 2000) this.changes.splice(0, this.changes.length - 2000);
  }

  async listChanges(projectId: string, limit = 50): Promise<GraphChangeRecord[]> {
    return this.changes.filter((c) => c.projectId === projectId).slice(-limit);
  }

  async exportProject(projectId: string): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    changes: GraphChangeRecord[];
  }> {
    return {
      nodes: [...this.nodes.values()].filter((n) => n.projectId === projectId),
      edges: [...this.edges.values()].filter((e) => e.projectId === projectId),
      changes: this.changes.filter((c) => c.projectId === projectId),
    };
  }

  async importProject(snapshot: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    changes?: GraphChangeRecord[];
  }): Promise<void> {
    for (const node of snapshot.nodes) this.nodes.set(node.id, node);
    for (const edge of snapshot.edges) this.edges.set(edge.id, edge);
    if (snapshot.changes) this.changes.push(...snapshot.changes);
  }

  /** Full dump for file persistence (all projects). */
  dumpAll(): {
    nodes: GraphNode[];
    edges: GraphEdge[];
    changes: GraphChangeRecord[];
  } {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      changes: [...this.changes],
    };
  }
}

export function createInMemoryGraphRepository(): InMemoryGraphRepository {
  return new InMemoryGraphRepository();
}
