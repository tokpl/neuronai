import { nowIso, type ArchitectureMap, type CodeRelationship, type ScannedFile } from '../types.js';
import { conceptsFromText } from './concepts.js';

/**
 * Where things live — the retrievable project map.
 * Paths are always repository-relative and complete.
 */
export interface ScanMapEntry {
  kind: 'module' | 'file' | 'symbol' | 'route';
  name: string;
  path: string;
  purpose?: string;
  module?: string;
  concepts?: string[];
}

export interface ScanProjectMap {
  version: 1;
  updatedAt: string;
  entries: ScanMapEntry[];
}

const SOURCE_ROOTS = ['src', 'lib', 'app', 'source'];

/**
 * Build a ProjectMap-compatible structure from scan findings.
 * Rebuilt wholesale each scan so deleted paths disappear.
 */
export function buildProjectMap(input: {
  files: ScannedFile[];
  architecture: ArchitectureMap;
  relationships?: CodeRelationship[];
  manifests?: string[];
}): ScanProjectMap {
  const paths = input.files.map((f) => f.relativePath.replace(/\\/g, '/'));
  const entries: ScanMapEntry[] = [];
  const seen = new Set<string>();

  const add = (entry: ScanMapEntry): void => {
    const key = `${entry.kind}:${entry.path}:${entry.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const concepts =
      entry.concepts?.length
        ? entry.concepts
        : conceptsFromText(entry.name, entry.path, entry.purpose, entry.module);
    entries.push({ ...entry, concepts: concepts.length ? concepts : undefined });
  };

  for (const name of input.architecture.modules) {
    const path = resolveModulePath(name, paths);
    add({
      kind: 'module',
      name,
      path,
      purpose: purposeForModule(name),
      module: name,
      concepts: conceptsFromText(name, path),
    });
  }

  const fileLayers: Array<{ files: string[]; purpose: string }> = [
    { files: input.architecture.routes, purpose: 'API routes / endpoints' },
    { files: input.architecture.services, purpose: 'Service / business logic' },
    { files: input.architecture.controllers, purpose: 'Controller / request handler' },
    { files: input.architecture.repositories, purpose: 'Repository / data access' },
    { files: input.architecture.databaseLayers, purpose: 'Database schema or migration' },
    { files: input.architecture.middleware ?? [], purpose: 'Middleware' },
    { files: input.architecture.entrypoints ?? [], purpose: 'Application entrypoint' },
  ];

  for (const layer of fileLayers) {
    for (const file of layer.files) {
      const path = normalizePath(file);
      add({
        kind: 'file',
        name: basename(path),
        path,
        purpose: layer.purpose,
        module: owningModule(path, input.architecture.modules),
        concepts: conceptsFromText(path, layer.purpose),
      });
    }
  }

  for (const manifest of input.manifests ?? []) {
    const path = normalizePath(manifest);
    add({
      kind: 'file',
      name: basename(path),
      path,
      purpose: 'Project configuration',
      concepts: ['configuration'],
    });
  }

  // Next.js App Router: app/api/**/route.ts
  for (const path of paths) {
    const match = /^(.+\/api\/.+?)\/route\.(t|j)sx?$/i.exec(path);
    if (!match) continue;
    const routePath = `/${match[1]!.replace(/^app\//, '').replace(/^src\/app\//, '')}`;
    add({
      kind: 'route',
      name: routePath,
      path,
      purpose: 'App Router API route',
      module: owningModule(path, input.architecture.modules),
      concepts: ['api'],
    });
  }

  for (const rel of input.relationships ?? []) {
    if (rel.kind !== 'export') continue;
    const name = rel.toModule.trim();
    const path = normalizePath(rel.fromFile);

    // Express / Fastify style: "POST /api/users"
    if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//i.test(name)) {
      add({
        kind: 'route',
        name,
        path,
        purpose: 'HTTP route handler',
        module: owningModule(path, input.architecture.modules),
        concepts: ['api', ...conceptsFromText(name, path)],
      });
      continue;
    }

    if (!/^[A-Za-z_][\w]*$/.test(name)) continue;
    add({
      kind: 'symbol',
      name,
      path,
      purpose: 'Exported symbol',
      module: owningModule(path, input.architecture.modules),
      concepts: conceptsFromText(name, path),
    });
  }

  // Cap: keep the map useful, not a full symbol table.
  const capped = prioritize(entries).slice(0, 400);

  return {
    version: 1,
    updatedAt: nowIso(),
    entries: capped,
  };
}

function prioritize(entries: ScanMapEntry[]): ScanMapEntry[] {
  const weight = (e: ScanMapEntry): number => {
    if (e.kind === 'module') return 0;
    if (e.kind === 'route') return 1;
    if (e.kind === 'file') return 2;
    return 3;
  };
  return [...entries].sort((a, b) => weight(a) - weight(b) || a.path.localeCompare(b.path));
}

function resolveModulePath(name: string, paths: string[]): string {
  const candidates = [
    ...SOURCE_ROOTS.map((root) => `${root}/${name}/`),
    `packages/${name}/`,
    `apps/${name}/`,
    `modules/${name}/`,
  ];
  for (const candidate of candidates) {
    if (paths.some((p) => p === candidate.slice(0, -1) || p.startsWith(candidate))) {
      return candidate;
    }
  }
  const nested = paths.find((p) => p.includes(`/${name}/`) || p.endsWith(`/${name}`));
  if (nested) {
    const idx = nested.indexOf(`/${name}/`);
    if (idx >= 0) return nested.slice(0, idx + name.length + 2);
    if (nested.endsWith(`/${name}`)) return `${nested}/`;
  }
  return `${name}/`;
}

function owningModule(path: string, modules: string[]): string | undefined {
  const normalized = normalizePath(path);
  for (const name of modules) {
    if (
      normalized.startsWith(`src/${name}/`) ||
      normalized.startsWith(`lib/${name}/`) ||
      normalized.startsWith(`app/${name}/`) ||
      normalized.startsWith(`packages/${name}/`) ||
      normalized.startsWith(`apps/${name}/`) ||
      normalized.includes(`/modules/${name}/`)
    ) {
      return name;
    }
  }
  return undefined;
}

function purposeForModule(name: string): string {
  const concepts = conceptsFromText(name);
  // Satellite folders share a domain word but are not the core implementation.
  if (/-(ui|frontend|web)$/i.test(name)) {
    if (concepts.includes('billing')) return 'Billing UI (not core billing logic)';
    return `UI module: ${name}`;
  }
  if (/-(admin|dashboard)$/i.test(name)) {
    if (concepts.includes('billing')) return 'Billing admin UI (not core billing logic)';
    return `Admin module: ${name}`;
  }
  if (/-(docs|doc)$/i.test(name)) return `Documentation: ${name}`;
  if (concepts.includes('auth')) return 'Authentication / authorization';
  if (concepts.includes('billing')) return 'Billing / payments';
  if (concepts.includes('api')) return 'API surface';
  if (concepts.includes('database')) return 'Data access';
  if (concepts.includes('users')) return 'User accounts';
  return `Project module: ${name}`;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function basename(path: string): string {
  const parts = normalizePath(path).split('/');
  return parts[parts.length - 1] || path;
}
