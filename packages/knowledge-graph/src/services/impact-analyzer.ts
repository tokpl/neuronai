import type { GraphNode } from '../domain/entities/graph-node.js';
import type { GraphRepository } from '../repositories/graph-repository.js';
import { GraphSearchEngine } from './graph-search-engine.js';

export interface ImpactReport {
  target: GraphNode;
  affected: Array<{
    node: GraphNode;
    distance: number;
    via: string;
  }>;
  impactScore: number;
  summary: string;
}

/**
 * Estimates blast radius of changing a node (service, module, file, dependency).
 */
export class ImpactAnalyzer {
  private readonly search: GraphSearchEngine;

  constructor(private readonly graph: GraphRepository) {
    this.search = new GraphSearchEngine(graph);
  }

  async analyze(projectId: string, targetQuery: string): Promise<ImpactReport | null> {
    const target = await this.resolveTarget(projectId, targetQuery);
    if (!target) return null;

    const neighbors = await this.search.neighbors(projectId, target.id, {
      depth: 3,
      direction: 'both',
      relationTypes: [
        'DEPENDS_ON',
        'IMPORTS',
        'USES',
        'AFFECTS',
        'CALLS',
        'RELATED_TO',
        'CAUSED',
        'FIXED_BY',
        'DOCUMENTS',
        'VIOLATES',
        'IMPLEMENTS',
        'REPLACES',
        'REPLACED_BY',
      ],
    });

    // Prefer reverse dependents (who depends on me)
    const incoming = await this.graph.findEdges({ projectId, toNodeId: target.id });
    const dependentIds = new Set(
      incoming
        .filter((e) => ['DEPENDS_ON', 'IMPORTS', 'USES', 'AFFECTS'].includes(e.relationType))
        .map((e) => e.fromNodeId),
    );

    const affectedMap = new Map<string, { node: GraphNode; distance: number; via: string }>();
    for (const hit of neighbors) {
      if (hit.node.id === target.id) continue;
      const via = hit.edge.relationType;
      const existing = affectedMap.get(hit.node.id);
      if (!existing || hit.depth < existing.distance) {
        affectedMap.set(hit.node.id, {
          node: hit.node,
          distance: hit.depth,
          via,
        });
      }
    }

    const affected = [...affectedMap.values()].sort((a, b) => a.distance - b.distance);
    const modules = affected.filter((a) => a.node.type === 'MODULE' || a.node.type === 'SERVICE');
    const directDependents = affected.filter((a) => dependentIds.has(a.node.id));

    let score = 0.2;
    score += Math.min(0.35, affected.length * 0.03);
    score += Math.min(0.25, modules.length * 0.05);
    score += Math.min(0.2, directDependents.length * 0.04);
    if (target.type === 'DEPENDENCY' || target.type === 'SERVICE') score += 0.1;
    if (target.type === 'DATABASE_TABLE') score += 0.15;
    score = Math.min(1, Math.round(score * 100) / 100);

    const names = modules.slice(0, 6).map((m) => m.node.name);
    const summary =
      names.length > 0
        ? `Changing ${target.name} may affect: ${names.join(', ')}`
        : `Changing ${target.name} has limited detected dependents (${affected.length} nodes).`;

    return {
      target,
      affected,
      impactScore: score,
      summary,
    };
  }

  private async resolveTarget(projectId: string, query: string): Promise<GraphNode | null> {
    const q = query.trim().toLowerCase();
    const all = await this.graph.findNodes({ projectId });
    const exact = all.find(
      (n) =>
        n.name.toLowerCase() === q ||
        n.path?.toLowerCase() === q ||
        n.name.toLowerCase().includes(q),
    );
    if (exact) return exact;

    // Fuzzy: PermissionService → permission service fragments
    const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
    let best: { node: GraphNode; score: number } | undefined;
    for (const node of all) {
      const hay = `${node.name} ${node.path ?? ''}`.toLowerCase();
      const score = tokens.filter((t) => hay.includes(t)).length;
      if (score === 0) continue;
      if (!best || score > best.score) best = { node, score };
    }
    return best?.node ?? null;
  }
}

export function createImpactAnalyzer(graph: GraphRepository): ImpactAnalyzer {
  return new ImpactAnalyzer(graph);
}
