import type { GraphNode } from '../domain/entities/graph-node.js';
import type { GraphRelationType } from '../domain/entities/graph-edge.js';
import type { GraphRepository } from '../repositories/graph-repository.js';
import { createArchitectureQueryService } from '../services/architecture-query.js';
import { createGraphSearchEngine } from '../services/graph-search-engine.js';
import { createImpactAnalyzer } from '../services/impact-analyzer.js';

export interface ImpactMapStep {
  node: GraphNode;
  depth: number;
  via: string;
}

export interface ImpactMap {
  question: string;
  seed: GraphNode | null;
  steps: ImpactMapStep[];
  summary: string;
  mermaid: string;
}

/**
 * GraphReasoner — multi-hop “what affects X?” style reasoning over the project brain.
 */
export class GraphReasoner {
  private readonly search;
  private readonly impact;
  private readonly architecture;

  constructor(private readonly graph: GraphRepository) {
    this.search = createGraphSearchEngine(graph);
    this.impact = createImpactAnalyzer(graph);
    this.architecture = createArchitectureQueryService(graph);
  }

  async reason(projectId: string, question: string): Promise<ImpactMap> {
    const candidates = seedCandidates(question);
    let seed: GraphNode | null = null;
    for (const c of candidates) {
      seed = await this.resolve(projectId, c);
      if (seed) break;
    }

    if (!seed) {
      const arch = await this.architecture.ask(projectId, question);
      return {
        question,
        seed: null,
        steps: [],
        summary: arch.answer,
        mermaid: 'flowchart TD\n  Q["Insufficient graph seed"]',
      };
    }

    const relationTypes: GraphRelationType[] = [
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
    ];

    const neighbors = await this.search.neighbors(projectId, seed.id, {
      depth: 4,
      direction: 'both',
      relationTypes,
    });

    const steps: ImpactMapStep[] = neighbors
      .filter((h) => h.node.id !== seed.id)
      .map((h) => ({
        node: h.node,
        depth: h.depth,
        via: h.edge.relationType,
      }))
      .sort((a, b) => a.depth - b.depth);

    const chain = [seed, ...steps.map((s) => s.node)].slice(0, 12);
    const names = chain.map((n) => n.name);
    const summary = `Impact map for "${seed.name}": ${names.join(' → ')}`;

    return {
      question,
      seed,
      steps,
      summary,
      mermaid: toMermaid(seed, steps.slice(0, 20)),
    };
  }

  async relatedKnowledge(projectId: string, query: string, limit = 20) {
    const seed = await this.resolve(projectId, query);
    if (!seed) {
      return { seed: null, nodes: [] as GraphNode[], memories: [] as GraphNode[] };
    }
    const hits = await this.search.neighbors(projectId, seed.id, {
      depth: 2,
      direction: 'both',
    });
    const nodes = hits.map((h) => h.node).slice(0, limit);
    const memories = nodes.filter(
      (n) =>
        n.type === 'MEMORY' ||
        n.type === 'DOCUMENT' ||
        n.type === 'INCIDENT' ||
        n.type === 'DECISION',
    );
    return { seed, nodes, memories };
  }

  private async resolve(projectId: string, query: string): Promise<GraphNode | null> {
    const report = await this.impact.analyze(projectId, query);
    return report?.target ?? null;
  }
}

function seedCandidates(question: string): string[] {
  const q = question.trim();
  const m =
    q.match(/affects?\s+(.+?)[?.!]?$/i) ||
    q.match(/impact\s+(?:of\s+)?(?:changing\s+)?(.+?)[?.!]?$/i) ||
    q.match(/related\s+to\s+(.+?)[?.!]?$/i);
  const primary = (m?.[1] ?? q.replace(/^(what|how|which|show|list)\s+/i, '')).trim();
  const out = [primary];
  const lower = primary.toLowerCase();
  if (lower.startsWith('auth')) out.push('auth', 'AuthService', 'authentication');
  if (lower.includes('user')) out.push('user', 'User');
  if (lower.includes('payment')) out.push('payment', 'Payment');
  // token fragments length > 3
  for (const t of lower.split(/[^a-z0-9]+/).filter((x) => x.length > 3)) {
    out.push(t);
  }
  return [...new Set(out.filter(Boolean))];
}

function toMermaid(seed: GraphNode, steps: ImpactMapStep[]): string {
  const lines = ['flowchart TD', `  n0["${esc(seed.name)}"]`];
  let i = 1;
  for (const s of steps) {
    lines.push(`  n${i}["${esc(s.node.name)}"]`);
    lines.push(`  n0 -->|${s.via}| n${i}`);
    i += 1;
  }
  return lines.join('\n');
}

function esc(s: string): string {
  return s.replace(/"/g, "'").slice(0, 40);
}

export function createGraphReasoner(graph: GraphRepository): GraphReasoner {
  return new GraphReasoner(graph);
}
