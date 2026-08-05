import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DependencyEdge, ProjectStackProfile } from '../types.js';

/**
 * Build a high-level dependency graph from manifests + stack profile.
 */
export class DependencyGraphBuilder {
  async build(root: string, stack: ProjectStackProfile): Promise<DependencyEdge[]> {
    const edges: DependencyEdge[] = [];

    for (const fe of stack.frontend) {
      if (fe === 'React' && stack.frontend.includes('Next.js')) {
        edges.push({ from: 'React', to: 'Next.js', relation: 'USES' });
      }
      if (fe === 'Next.js' && stack.tools.includes('Prisma')) {
        edges.push({ from: 'Next.js', to: 'Prisma', relation: 'USES' });
      }
    }
    if (stack.tools.includes('Prisma') && stack.database.some((d) => /postgres/i.test(d))) {
      edges.push({ from: 'Prisma', to: 'PostgreSQL', relation: 'USES' });
    }
    if (stack.backend.includes('NestJS') && stack.database.length) {
      edges.push({ from: 'NestJS', to: stack.database[0]!, relation: 'USES' });
    }
    if (stack.backend.includes('Express') && stack.database.length) {
      edges.push({ from: 'Express', to: stack.database[0]!, relation: 'USES' });
    }

    try {
      const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        name?: string;
      };
      const name = pkg.name ?? 'app';
      for (const dep of Object.keys(pkg.dependencies ?? {}).slice(0, 40)) {
        edges.push({ from: name, to: dep, relation: 'DEPENDS_ON' });
      }
    } catch {
      /* optional */
    }

    return dedupe(edges);
  }
}

function dedupe(edges: DependencyEdge[]): DependencyEdge[] {
  const seen = new Set<string>();
  const out: DependencyEdge[] = [];
  for (const e of edges) {
    const k = `${e.from}|${e.relation}|${e.to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

export function createDependencyGraphBuilder(): DependencyGraphBuilder {
  return new DependencyGraphBuilder();
}
