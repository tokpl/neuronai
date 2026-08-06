import type { ArchitectureMap, ScannedFile } from '../types.js';

/** Directories whose immediate children are modules in a single-package project. */
const SOURCE_ROOTS = new Set(['src', 'lib', 'app', 'source']);

/**
 * Discover architecture surface from paths / naming conventions.
 */
export class ArchitectureAnalyzer {
  analyze(files: ScannedFile[]): ArchitectureMap {
    const modules = new Set<string>();
    const services = new Set<string>();
    const controllers = new Set<string>();
    const repositories = new Set<string>();
    const components = new Set<string>();
    const routes = new Set<string>();
    const databaseLayers = new Set<string>();
    const middleware = new Set<string>();
    const entrypoints = new Set<string>();

    for (const f of files) {
      const p = f.relativePath.replace(/\\/g, '/');
      const parts = p.split('/');
      if (parts[0] === 'packages' && parts[1]) modules.add(parts[1]);
      if (parts[0] === 'apps' && parts[1]) modules.add(parts[1]);
      if (parts.includes('modules') && parts[parts.indexOf('modules') + 1]) {
        modules.add(parts[parts.indexOf('modules') + 1]!);
      }
      // The common single-package layout: src/<module>/<file>. Without this,
      // conventional projects reported zero modules.
      if (SOURCE_ROOTS.has(parts[0] ?? '') && parts.length >= 3 && parts[1]) {
        const child = parts[1]!;
        // Keep src/services as a module; skip file-level noise like src/index.ts
        // already handled by length >= 3.
        if (!/^(index|main|app|server|cli)$/i.test(child)) modules.add(child);
      }
      // Paths, not basenames: "where is X defined?" is answered by the path.
      if (/service/i.test(p)) services.add(p);
      if (/controller/i.test(p)) controllers.add(p);
      if (/repository|repo\./i.test(p)) repositories.add(p);
      if (/component/i.test(p) || /\.tsx$/i.test(p)) components.add(p);
      if (/route|router|endpoint/i.test(p) || /\/api\/.+\/route\.(t|j)sx?$/i.test(p)) {
        routes.add(p);
      }
      if (/schema|migration|prisma|drizzle|entity/i.test(p)) databaseLayers.add(p);
      if (/middleware/i.test(p)) middleware.add(p);
      const base = parts[parts.length - 1] ?? '';
      if (/^(main|index|server|app|cli)\.(ts|js|mjs|cjs|tsx|jsx)$/i.test(base)) {
        // Prefer top-level and src/ entrypoints over deep index.ts files.
        if (parts.length <= 3) entrypoints.add(p);
      }
    }

    const map: ArchitectureMap = {
      modules: [...modules].slice(0, 80),
      services: [...services].slice(0, 80),
      controllers: [...controllers].slice(0, 80),
      repositories: [...repositories].slice(0, 40),
      components: [...components].slice(0, 80),
      routes: [...routes].slice(0, 40),
      databaseLayers: [...databaseLayers].slice(0, 40),
      middleware: [...middleware].slice(0, 40),
      entrypoints: [...entrypoints].slice(0, 20),
      markdown: '',
    };
    map.markdown = renderArch(map);
    return map;
  }
}

function renderArch(m: ArchitectureMap): string {
  return [
    '# Architecture Map',
    '',
    '## Modules',
    ...(m.modules.length ? m.modules.map((x) => `- ${x}`) : ['- (none detected)']),
    '',
    '## Services',
    ...(m.services.length ? m.services.map((x) => `- ${x}`) : ['- (none detected)']),
    '',
    '## Controllers',
    ...(m.controllers.length ? m.controllers.map((x) => `- ${x}`) : ['- (none detected)']),
    '',
    '## Repositories / DB layer',
    ...(m.repositories.length || m.databaseLayers.length
      ? [...m.repositories, ...m.databaseLayers].map((x) => `- ${x}`)
      : ['- (none detected)']),
    '',
    '## Components',
    ...m.components.slice(0, 30).map((x) => `- ${x}`),
    '',
    '## Routes',
    ...(m.routes.length ? m.routes.map((x) => `- ${x}`) : ['- (none detected)']),
    '',
    '## Middleware',
    ...(m.middleware.length ? m.middleware.map((x) => `- ${x}`) : ['- (none detected)']),
    '',
    '## Entrypoints',
    ...(m.entrypoints.length ? m.entrypoints.map((x) => `- ${x}`) : ['- (none detected)']),
  ].join('\n');
}

export function createArchitectureAnalyzer(): ArchitectureAnalyzer {
  return new ArchitectureAnalyzer();
}
