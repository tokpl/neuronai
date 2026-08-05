import type { DependencyImpact, ProjectMemoryContext, RequirementAnalysis } from '../types.js';

/**
 * Estimate blast radius using memory modules + optional graph edges.
 */
export class DependencyImpactAnalyzer {
  analyze(
    requirement: RequirementAnalysis,
    memory?: ProjectMemoryContext,
  ): DependencyImpact {
    const root =
      requirement.affected.find((a) => /user/i.test(a)) ??
      requirement.affected[0] ??
      requirement.feature;

    const affected = new Set<string>(requirement.affected);

    for (const edge of memory?.graphEdges ?? []) {
      if (edge.from.toLowerCase().includes(root.toLowerCase().slice(0, 4))) {
        affected.add(edge.to);
      }
      if (edge.to.toLowerCase().includes(root.toLowerCase().slice(0, 4))) {
        affected.add(edge.from);
      }
    }

    // Classic User model fan-out
    if (/user/i.test(root) || /user/i.test(requirement.raw)) {
      for (const x of ['Authentication', 'Permissions', 'Profiles', 'Billing']) {
        affected.add(x);
      }
    }

    return { root, affected: [...affected] };
  }
}

export function createDependencyImpactAnalyzer(): DependencyImpactAnalyzer {
  return new DependencyImpactAnalyzer();
}
