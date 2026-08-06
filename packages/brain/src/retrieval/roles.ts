import type { ProjectMapEntry } from '../models.js';

/**
 * Semantic role of a map location. Used to prefer core implementation over
 * satellite/noise without hardcoding fixture paths.
 */
export type LocationRole =
  | 'core_module'
  | 'entrypoint'
  | 'route'
  | 'service'
  | 'repository'
  | 'database'
  | 'middleware'
  | 'worker'
  | 'adapter'
  | 'config'
  | 'test'
  | 'ui'
  | 'admin'
  | 'satellite'
  | 'noise'
  | 'generic';

const ROLE_BOOST: Record<LocationRole, number> = {
  database: 0.22,
  route: 0.2,
  service: 0.16,
  repository: 0.12,
  middleware: 0.14,
  worker: 0.1,
  adapter: 0.08,
  core_module: 0.1,
  entrypoint: 0.08,
  config: 0.05,
  generic: 0,
  test: -0.08,
  ui: -0.38,
  admin: -0.38,
  satellite: -0.42,
  noise: -0.5,
};

/** Classify a map entry into a stable location role. */
export function locationRole(loc: ProjectMapEntry): LocationRole {
  const path = loc.path.replace(/\\/g, '/').toLowerCase();
  const name = loc.name.toLowerCase();
  const purpose = (loc.purpose ?? '').toLowerCase();
  const blob = `${name} ${path} ${purpose}`;

  if (/-(ui|frontend|web)$/.test(name) || /\/(components|ui)\//.test(path) || /\.tsx$/.test(path)) {
    return 'ui';
  }
  if (/-(admin|dashboard)$/.test(name) || purpose.includes('admin ui')) return 'admin';
  if (
    /-(docs|doc)$/.test(name) ||
    /(^|\/)docs\//.test(path) ||
    purpose.includes('documentation') ||
    purpose.includes('not core')
  ) {
    return 'satellite';
  }
  if (/\.(test|spec)\.[tj]sx?$/.test(path) || /(^|\/)tests?\//.test(path)) return 'test';
  if (
    /\b(health|healthz|readyz|livez|ping)\b/.test(name) ||
    /\/health\.[tj]sx?$/.test(path) ||
    /routes\/health\./.test(path)
  ) {
    return 'noise';
  }
  if (
    loc.kind === 'route' ||
    /routes?\.[tj]sx?$/.test(path) ||
    /\b(router|routes)\b/.test(name) ||
    purpose.includes('api routes')
  ) {
    return 'route';
  }
  if (
    /(^|\/)db\//.test(path) ||
    /(^|\/)database\//.test(path) ||
    /schema|migration|drizzle|prisma/.test(blob) ||
    purpose.includes('data access') ||
    purpose.includes('database')
  ) {
    return 'database';
  }
  if (/repository|repositories/.test(blob)) return 'repository';
  if (/middleware/.test(blob)) return 'middleware';
  if (/\b(worker|job|jobs)\b/.test(blob)) return 'worker';
  if (/\b(client|adapter|stripe|sdk)\b/.test(blob) && !/service/.test(blob)) return 'adapter';
  if (/\bservice\b/.test(blob) || /service\.[tj]sx?$/.test(path)) return 'service';
  if (/config|env\.[tj]s$|dotenv/.test(blob) || purpose.includes('configuration')) return 'config';
  if (
    purpose.includes('entrypoint') ||
    /(^|\/)(main|server|app)\.[tj]sx?$/.test(path)
  ) {
    return 'entrypoint';
  }
  if (loc.kind === 'module') return 'core_module';
  return 'generic';
}

export function locationRoleBoost(loc: ProjectMapEntry | undefined): number {
  if (!loc) return 0;
  return ROLE_BOOST[locationRole(loc)] ?? 0;
}

/**
 * Query-sensitive nudges on top of the base role boost.
 * Keeps the core ranking general while fixing common “wrong start” cases.
 */
export function locationQueryBoost(query: string, loc: ProjectMapEntry | undefined): number {
  if (!loc) return 0;
  const q = query.toLowerCase();
  const role = locationRole(loc);
  let boost = 0;

  if (/\b(endpoint|route|router|api request|api routes?)\b/.test(q)) {
    if (role === 'route') boost += 0.25;
    if (role === 'noise') boost -= 0.35;
    if (role === 'ui' || role === 'admin') boost -= 0.2;
  }

  if (/\b(database|db access|data access|schema|migration)\b/.test(q)) {
    if (role === 'database') boost += 0.35;
    if (role === 'repository') boost += 0.08;
    if (role === 'ui' || role === 'admin' || role === 'noise') boost -= 0.2;
  }

  if (/\b(billing|payment|invoice|auth|authentication)\b/.test(q)) {
    if (role === 'ui' || role === 'admin' || role === 'satellite') boost -= 0.15;
    if (role === 'service' || role === 'route' || role === 'core_module') boost += 0.08;
  }

  if (/\btests?\b/.test(q) && role === 'test') boost += 0.3;

  return boost;
}
