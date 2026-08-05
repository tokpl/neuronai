import type { ArchitectureMap, ScannedFile } from '../types.js';

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

    for (const f of files) {
      const p = f.relativePath.replace(/\\/g, '/');
      const parts = p.split('/');
      if (parts[0] === 'packages' && parts[1]) modules.add(parts[1]);
      if (parts[0] === 'apps' && parts[1]) modules.add(parts[1]);
      if (parts.includes('modules') && parts[parts.indexOf('modules') + 1]) {
        modules.add(parts[parts.indexOf('modules') + 1]!);
      }
      if (/service/i.test(p)) services.add(basename(p));
      if (/controller/i.test(p)) controllers.add(basename(p));
      if (/repository|repo\./i.test(p)) repositories.add(basename(p));
      if (/component/i.test(p) || /\.tsx$/i.test(p)) components.add(basename(p));
      if (/route|router|endpoint/i.test(p)) routes.add(basename(p));
      if (/schema|migration|prisma|drizzle|entity/i.test(p)) databaseLayers.add(basename(p));
    }

    const map: ArchitectureMap = {
      modules: [...modules].slice(0, 80),
      services: [...services].slice(0, 80),
      controllers: [...controllers].slice(0, 80),
      repositories: [...repositories].slice(0, 40),
      components: [...components].slice(0, 80),
      routes: [...routes].slice(0, 40),
      databaseLayers: [...databaseLayers].slice(0, 40),
      markdown: '',
    };
    map.markdown = renderArch(map);
    return map;
  }
}

function basename(p: string): string {
  return p.split('/').pop() ?? p;
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
    ...(m.components.slice(0, 30).map((x) => `- ${x}`)),
    '',
    '## Routes',
    ...(m.routes.length ? m.routes.map((x) => `- ${x}`) : ['- (none detected)']),
  ].join('\n');
}

export function createArchitectureAnalyzer(): ArchitectureAnalyzer {
  return new ArchitectureAnalyzer();
}
