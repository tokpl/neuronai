import type { ProjectBrain } from '@neuronai/brain';

import type { GraphChangeRecord } from '../domain/entities/graph-change.js';
import type { GraphEdge } from '../domain/entities/graph-edge.js';
import type { GraphNode } from '../domain/entities/graph-node.js';
import {
  createInMemoryGraphRepository,
  type InMemoryGraphRepository,
} from './in-memory-graph-repository.js';
import type { GraphRepository } from './graph-repository.js';

/**
 * Graph repository backed by a live ProjectBrain instance (knowledge.graph).
 * Never writes knowledge.json outside ProjectBrain.
 */
export class BrainGraphRepository implements GraphRepository {
  private readonly inner: InMemoryGraphRepository;
  private loaded = false;

  constructor(
    private readonly brain: ProjectBrain,
    inner?: InMemoryGraphRepository,
  ) {
    this.inner = inner ?? createInMemoryGraphRepository();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const graph = this.brain.getGraph();
    await this.inner.importProject({
      nodes: (graph.nodes ?? []) as GraphNode[],
      edges: (graph.edges ?? []) as GraphEdge[],
      changes: (graph.changes ?? []) as GraphChangeRecord[],
    });
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const all = this.inner.dumpAll();
    await this.brain.updateGraph({
      nodes: all.nodes,
      edges: all.edges,
      changes: all.changes,
    });
  }

  async upsertNode(node: GraphNode): Promise<GraphNode> {
    await this.ensureLoaded();
    const result = await this.inner.upsertNode(node);
    await this.persist();
    return result;
  }

  async getNode(id: string): Promise<GraphNode | null> {
    await this.ensureLoaded();
    return this.inner.getNode(id);
  }

  async findNodes(
    filter: Parameters<GraphRepository['findNodes']>[0],
  ): Promise<GraphNode[]> {
    await this.ensureLoaded();
    return this.inner.findNodes(filter);
  }

  async removeNode(id: string): Promise<void> {
    await this.ensureLoaded();
    await this.inner.removeNode(id);
    await this.persist();
  }

  async upsertEdge(edge: GraphEdge): Promise<GraphEdge> {
    await this.ensureLoaded();
    const result = await this.inner.upsertEdge(edge);
    await this.persist();
    return result;
  }

  async getEdge(id: string): Promise<GraphEdge | null> {
    await this.ensureLoaded();
    return this.inner.getEdge(id);
  }

  async findEdges(
    filter: Parameters<GraphRepository['findEdges']>[0],
  ): Promise<GraphEdge[]> {
    await this.ensureLoaded();
    return this.inner.findEdges(filter);
  }

  async removeEdge(id: string): Promise<void> {
    await this.ensureLoaded();
    await this.inner.removeEdge(id);
    await this.persist();
  }

  async appendChange(change: GraphChangeRecord): Promise<void> {
    await this.ensureLoaded();
    await this.inner.appendChange(change);
    await this.persist();
  }

  async listChanges(projectId: string, limit?: number): Promise<GraphChangeRecord[]> {
    await this.ensureLoaded();
    return this.inner.listChanges(projectId, limit);
  }

  async exportProject(projectId: string) {
    await this.ensureLoaded();
    return this.inner.exportProject(projectId);
  }

  async importProject(snapshot: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    changes?: GraphChangeRecord[];
  }): Promise<void> {
    await this.ensureLoaded();
    await this.inner.importProject(snapshot);
    await this.persist();
  }
}

export function createBrainGraphRepository(brain: ProjectBrain): BrainGraphRepository {
  return new BrainGraphRepository(brain);
}
