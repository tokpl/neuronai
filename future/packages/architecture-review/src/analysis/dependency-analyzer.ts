import type {
  CircularDependency,
  CouplingFinding,
  DependencyAnalysisResult,
  DependencyEdge,
  ModuleNode,
} from '../types.js';

/**
 * Analyzes imports / package / module relations.
 * Detects cycles, high coupling, unused modules.
 */
export class DependencyAnalyzer {
  analyze(modules: ModuleNode[], edges: DependencyEdge[]): DependencyAnalysisResult {
    const ids = new Set(modules.map((m) => m.id));
    const circular = findCycles(edges, ids);
    const coupling = computeCoupling(modules, edges);
    const referenced = new Set<string>();
    for (const e of edges) {
      referenced.add(e.from);
      referenced.add(e.to);
    }
    // Modules that nothing depends on and that depend on nothing (except entry points with fanOut)
    const unusedModules = modules
      .filter((m) => {
        const fanIn = edges.filter((e) => e.to === m.id).length;
        const fanOut = edges.filter((e) => e.from === m.id).length;
        return fanIn === 0 && fanOut === 0 && modules.length > 1;
      })
      .map((m) => m.id);

    return { edges, circular, coupling, unusedModules };
  }
}

function computeCoupling(modules: ModuleNode[], edges: DependencyEdge[]): CouplingFinding[] {
  return modules.map((m) => {
    const fanIn = edges.filter((e) => e.to === m.id).length;
    const fanOut = edges.filter((e) => e.from === m.id).length;
    return {
      moduleId: m.id,
      fanIn,
      fanOut,
      highCoupling: fanIn + fanOut >= 6 || fanOut >= 5,
    };
  });
}

function findCycles(edges: DependencyEdge[], ids: Set<string>): CircularDependency[] {
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }

  const cycles: CircularDependency[] = [];
  const seenCycles = new Set<string>();
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  for (const id of adj.keys()) color.set(id, WHITE);

  const dfs = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      if (!color.has(next)) color.set(next, WHITE);
      const c = color.get(next)!;
      if (c === GRAY) {
        const idx = stack.indexOf(next);
        const cycle = [...stack.slice(idx), next];
        const key = normalizeCycle(cycle);
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          cycles.push({
            cycle,
            warning: `Circular dependency: ${cycle.join(' → ')}`,
          });
        }
      } else if (c === WHITE) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };

  for (const id of adj.keys()) {
    if (color.get(id) === WHITE) dfs(id);
  }
  return cycles;
}

function normalizeCycle(cycle: string[]): string {
  const body = cycle.slice(0, -1);
  const min = Math.min(...body.map((_, i) => i));
  const rotated = [...body.slice(min), ...body.slice(0, min)];
  return rotated.join('>');
}

export function createDependencyAnalyzer(): DependencyAnalyzer {
  return new DependencyAnalyzer();
}
