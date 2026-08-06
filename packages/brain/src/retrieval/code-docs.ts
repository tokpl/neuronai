import type { CodeIntelligence, CodeSymbolNode } from '@neuronai/types';

import type { RetrievalDoc } from './rank.js';
import { explainFlow, getImpact, getSymbol } from '../code/queries.js';
import type { QueryIntent } from './intent.js';
import type { ModificationAdvice } from './recommend.js';

/**
 * Expand a recommendation into a connected slice using verified relationships.
 * Prefers high-confidence edges; never invents links.
 */
export function expandConnectedSlice(
  code: CodeIntelligence | undefined,
  recommendation: ModificationAdvice | undefined,
  intent: QueryIntent,
): {
  symbol?: string;
  flow: Array<{ label: string; path?: string }>;
  related: Array<{ path: string; name: string }>;
  dependencies: Array<{ path: string; name: string; confidence: string }>;
  impactFiles: string[];
} {
  if (!code || !recommendation) {
    return { flow: [], related: recommendation?.related ?? [], dependencies: [], impactFiles: [] };
  }

  const sym =
    getSymbol(code, recommendation.name) ??
    code.symbols.find(
      (s) => s.path === recommendation.path && s.exported && (s.kind === 'class' || s.kind === 'function'),
    );

  const target = sym?.id ?? recommendation.path;
  const impact = getImpact(code, target);
  const flow = explainFlow(code, target).map((s) => ({ label: s.label, path: s.path }));

  const deps = (impact?.dependencies ?? [])
    .filter((d) => d.confidence === 'high' || (d.confidence === 'medium' && d.relation === 'IMPORTS'))
    .slice(0, 4)
    .map((d) => ({ path: d.path, name: d.name, confidence: d.confidence }));

  const relatedFromImpact = [
    ...(impact?.dependents ?? [])
      .filter((d) => d.confidence === 'high')
      .slice(0, 4)
      .map((d) => ({ path: d.path, name: d.name })),
    ...(impact?.relatedTests ?? []).slice(0, 2).map((p) => ({ path: p, name: basename(p) })),
  ];

  const related = dedupePaths([...(recommendation.related ?? []), ...relatedFromImpact]).slice(0, 6);

  // For IMPACT / DEPENDENCY intents, surface dependents as the primary related set
  if (intent === 'IMPACT' || intent === 'DEPENDENCY') {
    return {
      symbol: sym ? formatSymbol(sym) : undefined,
      flow,
      related: dedupePaths([
        ...(impact?.dependents ?? []).slice(0, 6).map((d) => ({ path: d.path, name: d.name })),
        ...related,
      ]),
      dependencies: deps,
      impactFiles: impact?.relatedFiles ?? [],
    };
  }

  return {
    symbol: sym ? formatSymbol(sym) : undefined,
    flow,
    related,
    dependencies: deps,
    impactFiles: impact?.relatedFiles ?? [],
  };
}

/** Emit compact retrieval docs from code intelligence (same lexical index). */
export function codeDocs(code: CodeIntelligence | undefined, freshness = 0.85): RetrievalDoc[] {
  if (!code) return [];
  const docs: RetrievalDoc[] = [];

  for (const sym of code.symbols) {
    if (!sym.exported && sym.kind !== 'route') continue;
    if (sym.kind === 'method' && !sym.parent) continue;
    docs.push({
      id: `code:symbol:${sym.id}`,
      title: `${sym.name} — ${sym.path}`,
      content: [
        sym.summary,
        `Kind: ${sym.kind}`,
        sym.role ? `Role: ${sym.role}` : undefined,
        `Location: ${sym.path}`,
        sym.parent ? `Parent: ${sym.parent}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
      kind: 'location',
      tags: [...(sym.concepts ?? []), sym.kind, ...(sym.role ? [sym.role] : [])],
      importance: sym.kind === 'route' || sym.kind === 'class' ? 0.72 : 0.62,
      freshness,
      confidence: 0.9,
      location: {
        kind: sym.kind === 'route' ? 'route' : 'symbol',
        name: sym.parent ? `${sym.parent}.${sym.name}` : sym.name,
        path: sym.path,
        purpose: sym.summary,
        module: undefined,
        concepts: sym.concepts,
      },
    });
  }

  // Cap docs so the in-memory index stays fast
  return docs.slice(0, 800);
}

function formatSymbol(sym: CodeSymbolNode): string {
  if (sym.parent) return `${sym.parent}.${sym.name}()`;
  if (sym.kind === 'class') return sym.name;
  if (sym.kind === 'function' || sym.kind === 'method') return `${sym.name}()`;
  return sym.name;
}

function dedupePaths(items: Array<{ path: string; name: string }>): Array<{ path: string; name: string }> {
  const seen = new Set<string>();
  const out: Array<{ path: string; name: string }> = [];
  for (const item of items) {
    const key = item.path.replace(/\\/g, '/');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}
