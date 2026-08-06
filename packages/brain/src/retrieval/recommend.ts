import type { RetrievalHit } from './rank.js';
import type { QueryIntent } from './intent.js';
import { locationQueryBoost, locationRole, locationRoleBoost } from './roles.js';

/**
 * Where the agent should start changing code — not a second retrieval engine,
 * just the best location hit already selected for the compiled context.
 */
export interface ModificationAdvice {
  path: string;
  name: string;
  kind: string;
  /** Short human reason. Safe for CLI / structured MCP; kept out of ranking fields. */
  reason: string;
  related: Array<{ path: string; name: string }>;
  /** Optional verified symbol label, e.g. InvoiceService.cancelInvoice(). */
  symbol?: string;
  /** Verified flow steps when evidence exists. */
  flow?: Array<{ label: string; path?: string }>;
  /** High-confidence dependencies. */
  dependencies?: Array<{ path: string; name: string }>;
}

/**
 * Prefer concrete edit targets (services, routes, symbols) over bare modules
 * when the developer asks where to add or change something.
 */
export function pickRecommendation(
  intent: QueryIntent,
  hits: RetrievalHit[],
  includedTitles: Set<string>,
  query = '',
): ModificationAdvice | undefined {
  if (
    intent !== 'MODIFICATION' &&
    intent !== 'LOCATION' &&
    intent !== 'IMPLEMENTATION' &&
    intent !== 'DEPENDENCY' &&
    intent !== 'IMPACT'
  ) {
    return undefined;
  }

  const locations = hits.filter((hit) => hit.doc.location && includedTitles.has(hit.doc.title));
  if (locations.length === 0) return undefined;

  const wantsRoute = /\b(endpoint|route|router|handler)\b/i.test(query);
  const wantsTest = /\btests?\b/i.test(query);
  const wantsDb = /\b(database|db access|data access)\b/i.test(query);

  const score = (hit: RetrievalHit): number => {
    const loc = hit.doc.location!;
    const blob = `${loc.name} ${loc.path} ${loc.purpose ?? ''}`.toLowerCase();
    const role = locationRole(loc);
    let s = hit.score + locationRoleBoost(loc) + locationQueryBoost(query, loc);
    if (/service|repository|controller|handler|middleware|route|router/.test(blob)) s += 0.35;
    if (loc.kind === 'symbol') s += 0.2;
    if (loc.kind === 'file') s += 0.15;
    if (loc.kind === 'route') s += 0.25;
    if (loc.kind === 'module') s -= 0.05;
    if (intent === 'MODIFICATION' && loc.kind === 'module') s -= 0.1;
    if (
      wantsRoute &&
      (role === 'route' || /routes?\.(t|j)sx?$/.test(loc.path) || /router|route/.test(blob))
    ) {
      s += 0.5;
    }
    if (wantsRoute && role === 'noise') s -= 0.55;
    if (wantsRoute && /service\.(t|j)sx?$/.test(loc.path) && !/route/.test(blob)) s -= 0.2;
    if (wantsTest && role === 'test') s += 0.45;
    if (wantsDb && role === 'database') s += 0.45;
    if (role === 'ui' || role === 'admin' || role === 'satellite') s -= 0.4;
    return s;
  };

  const ranked = [...locations].sort((a, b) => score(b) - score(a));
  const best = ranked[0]!;
  const loc = best.doc.location!;

  const reasonParts = [
    loc.purpose,
    loc.module ? `belongs to the ${loc.module} module` : undefined,
    loc.kind === 'symbol' ? `defines ${loc.name}` : undefined,
    loc.kind === 'route' ? 'existing route surface' : undefined,
  ].filter(Boolean);

  return {
    path: loc.path,
    name: loc.name,
    kind: loc.kind,
    reason: reasonParts.join('; ') || best.why,
    related: ranked.slice(1, 4).map((hit) => ({
      path: hit.doc.location!.path,
      name: hit.doc.location!.name,
    })),
  };
}
