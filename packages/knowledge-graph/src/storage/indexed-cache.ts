import type { GraphEdge } from '../domain/entities/graph-edge.js';
import type { GraphNode } from '../domain/entities/graph-node.js';
import type { GraphRepository } from '../repositories/graph-repository.js';

/**
 * In-memory adjacency indexes for fast traversal (targets 100k nodes / 1M edges scale locally).
 * Lazy: build() loads project slice once; subsequent neighbor lookups use indexes.
 */
export class IndexedGraphCache {
  private nodes: GraphNode[] = [];
  private byId = new Map<string, GraphNode>();
  private out = new Map<string, GraphEdge[]>();
  private inn = new Map<string, GraphEdge[]>();
  private builtFor: string | null = null;

  constructor(private readonly graph: GraphRepository) {}

  async build(projectId: string): Promise<IndexedGraphCacheView> {
    if (this.builtFor === projectId && this.nodes.length) {
      return this.view();
    }
    const snap = await this.graph.exportProject(projectId);
    this.nodes = snap.nodes;
    this.byId = new Map(snap.nodes.map((n) => [n.id, n]));
    this.out = new Map();
    this.inn = new Map();
    for (const e of snap.edges) {
      const o = this.out.get(e.fromNodeId) ?? [];
      o.push(e);
      this.out.set(e.fromNodeId, o);
      const i = this.inn.get(e.toNodeId) ?? [];
      i.push(e);
      this.inn.set(e.toNodeId, i);
    }
    this.builtFor = projectId;
    return this.view();
  }

  /** Invalidate after mutations so next build() reloads. */
  invalidate(): void {
    this.builtFor = null;
    this.nodes = [];
    this.byId.clear();
    this.out.clear();
    this.inn.clear();
  }

  private view(): IndexedGraphCacheView {
    return {
      nodes: this.nodes,
      get: (id: string) => this.byId.get(id),
      outbound: (id: string) => this.out.get(id) ?? [],
      inbound: (id: string) => this.inn.get(id) ?? [],
      degree: (id: string) => (this.out.get(id)?.length ?? 0) + (this.inn.get(id)?.length ?? 0),
    };
  }
}

export interface IndexedGraphCacheView {
  nodes: GraphNode[];
  get: (id: string) => GraphNode | undefined;
  outbound: (id: string) => GraphEdge[];
  inbound: (id: string) => GraphEdge[];
  degree: (id: string) => number;
}

export function createIndexedGraphCache(graph: GraphRepository): IndexedGraphCache {
  return new IndexedGraphCache(graph);
}
