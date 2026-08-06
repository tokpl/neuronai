import type {
  CodeEdge,
  CodeIntelligence,
  CodeSymbolNode,
  RelationConfidence,
} from '@neuronai/types';

export interface CodeImpactItem {
  id: string;
  path: string;
  name: string;
  relation: string;
  confidence: RelationConfidence;
  evidence: string;
}

export interface CodeImpact {
  target: { id: string; name: string; path: string };
  dependents: CodeImpactItem[];
  dependencies: CodeImpactItem[];
  relatedFiles: string[];
  relatedTests: string[];
  relatedRoutes: string[];
}

export interface CodeFlowStep {
  label: string;
  path?: string;
  confidence: RelationConfidence;
}

/**
 * Prefer high-confidence edges. Never surface low-confidence CALLS/ROUTE_TO
 * as if they were proven.
 */
function usable(edge: CodeEdge, forImpact = false): boolean {
  if (edge.confidence === 'low') return false;
  if (forImpact && edge.confidence === 'medium' && (edge.type === 'CALLS' || edge.type === 'ROUTE_TO')) {
    // Medium call/route edges are OK for "related" but listed as medium.
    return true;
  }
  return true;
}

export function findSymbols(code: CodeIntelligence | undefined, name: string): CodeSymbolNode[] {
  if (!code) return [];
  const q = name.trim().toLowerCase();
  if (!q) return [];
  return code.symbols.filter(
    (s) => s.name.toLowerCase() === q || s.id.toLowerCase().endsWith(`#${q}`) || s.id.toLowerCase().endsWith(`.${q}`),
  );
}

export function getSymbol(
  code: CodeIntelligence | undefined,
  idOrName: string,
): CodeSymbolNode | undefined {
  if (!code) return undefined;
  const exact = code.symbols.find((s) => s.id === idOrName);
  if (exact) return exact;
  const matches = findSymbols(code, idOrName);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Outgoing structural deps (verified first). */
export function getDependencies(
  code: CodeIntelligence | undefined,
  target: string,
): CodeImpactItem[] {
  if (!code) return [];
  const node = resolveTarget(code, target);
  if (!node) return [];
  const keys = new Set([node.id, node.path]);
  return code.edges
    .filter((e) => keys.has(e.from) && usable(e) && ['IMPORTS', 'CALLS', 'EXTENDS', 'IMPLEMENTS', 'ROUTE_TO'].includes(e.type))
    .map((e) => toItem(code, e, 'to'))
    .filter((x): x is CodeImpactItem => Boolean(x));
}

/** Incoming dependents (who uses this). */
export function getDependents(
  code: CodeIntelligence | undefined,
  target: string,
): CodeImpactItem[] {
  if (!code) return [];
  const node = resolveTarget(code, target);
  if (!node) return [];
  const keys = new Set([node.id, node.path]);
  // Class impact includes calls to its methods.
  for (const s of code.symbols) {
    if (s.parent && (s.parent === node.name || node.id.endsWith(`#${s.parent}`))) {
      keys.add(s.id);
    }
  }
  return code.edges
    .filter((e) => keys.has(e.to) && usable(e) && ['IMPORTS', 'CALLS', 'EXTENDS', 'IMPLEMENTS', 'ROUTE_TO', 'EXPORTS'].includes(e.type))
    .map((e) => toItem(code, e, 'from'))
    .filter((x): x is CodeImpactItem => Boolean(x));
}

export function getImpact(code: CodeIntelligence | undefined, target: string): CodeImpact | undefined {
  if (!code) return undefined;
  const node = resolveTarget(code, target);
  if (!node) return undefined;

  const dependencies = uniqueItems(getDependencies(code, node.id));
  const dependents = uniqueItems(getDependents(code, node.id));

  // Also: files that IMPORT this file
  for (const e of code.edges) {
    if (e.type !== 'IMPORTS' || !usable(e)) continue;
    if (e.to === node.path || e.to === node.id) {
      dependents.push({
        id: e.from,
        path: e.from.split('#')[0]!,
        name: basename(e.from),
        relation: 'IMPORTS',
        confidence: e.confidence,
        evidence: e.evidence.detail,
      });
    }
  }

  const relatedFiles = [
    ...new Set([
      node.path,
      ...dependencies.map((d) => d.path),
      ...dependents.map((d) => d.path),
    ]),
  ];

  const relatedTests = relatedFiles.filter(
    (p) => /\.(test|spec)\.[tj]sx?$/i.test(p) || /(^|\/)tests?\//i.test(p),
  );
  const relatedRoutes = code.symbols
    .filter((s) => s.kind === 'route' && relatedFiles.includes(s.path))
    .map((s) => s.name);

  return {
    target: { id: node.id, name: node.name, path: node.path },
    dependencies: uniqueItems(dependencies).slice(0, 12),
    dependents: uniqueItems(dependents).slice(0, 12),
    relatedFiles: relatedFiles.slice(0, 16),
    relatedTests: relatedTests.slice(0, 8),
    relatedRoutes: relatedRoutes.slice(0, 8),
  };
}

/**
 * Reconstruct a short flow from a route/symbol when verified ROUTE_TO / CALLS exist.
 */
export function explainFlow(
  code: CodeIntelligence | undefined,
  target: string,
): CodeFlowStep[] {
  if (!code) return [];
  const node = resolveTarget(code, target);
  if (!node) return [];

  const steps: CodeFlowStep[] = [
    { label: node.name, path: node.path, confidence: 'high' },
  ];
  let current = node.id;
  const seen = new Set([current]);

  for (let depth = 0; depth < 4; depth += 1) {
    const next = code.edges.find(
      (e) =>
        e.from === current &&
        usable(e) &&
        (e.type === 'ROUTE_TO' || e.type === 'CALLS') &&
        e.confidence === 'high' &&
        !seen.has(e.to),
    );
    if (!next) break;
    seen.add(next.to);
    current = next.to;
    const sym = code.symbols.find((s) => s.id === next.to);
    steps.push({
      label: sym?.summary ?? sym?.name ?? next.to,
      path: sym?.path ?? next.to.split('#')[0],
      confidence: next.confidence,
    });
  }

  return steps.length > 1 ? steps : [];
}

export function explainSymbol(code: CodeIntelligence | undefined, target: string): string | undefined {
  if (!code) return undefined;
  const node = getSymbol(code, target) ?? code.files.find((f) => f.path === target);
  if (!node) return undefined;
  const path = 'path' in node ? node.path : target;
  const name = 'name' in node && typeof (node as CodeSymbolNode).name === 'string'
    ? (node as CodeSymbolNode).name
    : basename(path);
  const id = 'id' in node ? (node as CodeSymbolNode).id : path;
  const file = code.files.find((f) => f.path === path);
  const deps = getDependencies(code, id).filter((d) => d.confidence === 'high').slice(0, 5);
  const usedBy = getDependents(code, id).filter((d) => d.confidence === 'high').slice(0, 5);
  const sym = node as CodeSymbolNode;
  const lines = [
    sym.summary ?? (`kind` in sym ? `${sym.kind} ${name}` : file?.summary) ?? name,
    `Location: ${path}`,
    sym.role ? `Role: ${sym.role}` : undefined,
    file?.summary,
    deps.length ? `Depends on: ${deps.map((d) => d.name).join(', ')}` : undefined,
    usedBy.length ? `Used by: ${usedBy.map((d) => d.name).join(', ')}` : undefined,
  ].filter(Boolean);
  return lines.join('\n');
}

function resolveTarget(
  code: CodeIntelligence,
  target: string,
): { id: string; name: string; path: string } | undefined {
  const byId = code.symbols.find((s) => s.id === target);
  if (byId) return { id: byId.id, name: byId.name, path: byId.path };
  const byPath = code.files.find((f) => f.path === target);
  if (byPath) return { id: byPath.path, name: basename(byPath.path), path: byPath.path };
  const matches = findSymbols(code, target);
  if (matches.length === 1) {
    const s = matches[0]!;
    return { id: s.id, name: s.name, path: s.path };
  }
  // Prefer exported class/service when multiple
  const preferred = matches.find((s) => s.kind === 'class' || s.role === 'service');
  if (preferred) return { id: preferred.id, name: preferred.name, path: preferred.path };
  return undefined;
}

function toItem(
  code: CodeIntelligence,
  edge: CodeEdge,
  side: 'from' | 'to',
): CodeImpactItem | undefined {
  const ref = side === 'to' ? edge.to : edge.from;
  const sym = code.symbols.find((s) => s.id === ref);
  const path = sym?.path ?? ref.split('#')[0]!;
  return {
    id: ref,
    path,
    name: sym?.name ?? basename(ref),
    relation: edge.type,
    confidence: edge.confidence,
    evidence: edge.evidence.detail,
  };
}

function uniqueItems(items: CodeImpactItem[]): CodeImpactItem[] {
  const seen = new Set<string>();
  const out: CodeImpactItem[] = [];
  for (const item of items) {
    const key = `${item.relation}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function basename(id: string): string {
  const path = id.split('#')[0] ?? id;
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || id;
}
