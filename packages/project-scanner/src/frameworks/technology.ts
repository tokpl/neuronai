import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { detectProjectStack } from '@neuron-ai-memory/project-analyzer';

import type { ProjectStackProfile } from '../types.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect project stack from manifests + common config files.
 */
export class TechnologyDetector {
  async detect(root: string): Promise<ProjectStackProfile> {
    const base = await detectProjectStack(root);
    const frontend = new Set<string>();
    const backend = new Set<string>();
    const database = new Set(base.databases);
    const tools = new Set<string>();

    for (const fw of base.frameworks) {
      if (['react', 'nextjs', 'vue', 'angular', 'svelte'].includes(fw)) frontend.add(pretty(fw));
      if (['nestjs', 'express', 'fastify', 'django', 'flask', 'laravel', 'spring'].includes(fw)) {
        backend.add(pretty(fw));
      }
    }

    const pkgPath = join(root, 'package.json');
    if (await exists(pkgPath)) {
      try {
        const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['react']) frontend.add('React');
        if (deps['next']) frontend.add('Next.js');
        if (deps['@nestjs/core']) backend.add('NestJS');
        if (deps['express']) backend.add('Express');
        if (deps['prisma'] || deps['@prisma/client']) tools.add('Prisma');
        if (deps['typeorm']) tools.add('TypeORM');
        if (deps['drizzle-orm']) tools.add('Drizzle');
      } catch {
        /* ignore */
      }
    }

    if (await exists(join(root, 'docker-compose.yml')) || (await exists(join(root, 'docker-compose.yaml')))) {
      tools.add('Docker');
    }
    if (await exists(join(root, 'Dockerfile'))) tools.add('Docker');
    if (await exists(join(root, 'composer.json'))) {
      backend.add('PHP');
      tools.add('Composer');
    }
    if (await exists(join(root, 'requirements.txt')) || (await exists(join(root, 'pyproject.toml')))) {
      if (!backend.size) backend.add('Python');
    }
    if (await exists(join(root, 'go.mod'))) backend.add('Go');
    if (await exists(join(root, 'Cargo.toml'))) backend.add('Rust');
    if (await exists(join(root, 'pom.xml')) || (await exists(join(root, 'build.gradle')))) {
      backend.add('Java');
    }

    if (database.has('postgresql')) {
      /* keep */
    }

    return {
      frontend: [...frontend],
      backend: [...backend],
      database: [...database].map(pretty),
      tools: [...tools],
      languages: base.languages,
      packageManagers: base.packageManagers,
      manifests: base.manifests,
    };
  }

  format(stack: ProjectStackProfile): string {
    return [
      'Project Stack:',
      '',
      `Frontend:`,
      ...(stack.frontend.length ? stack.frontend.map((x) => `  ${x}`) : ['  (none detected)']),
      '',
      `Backend:`,
      ...(stack.backend.length ? stack.backend.map((x) => `  ${x}`) : ['  (none detected)']),
      '',
      `Database:`,
      ...(stack.database.length ? stack.database.map((x) => `  ${x}`) : ['  (none detected)']),
      '',
      `Tools:`,
      ...(stack.tools.length ? stack.tools.map((x) => `  ${x}`) : ['  (none detected)']),
    ].join('\n');
  }
}

function pretty(id: string): string {
  const map: Record<string, string> = {
    react: 'React',
    nextjs: 'Next.js',
    nestjs: 'NestJS',
    express: 'Express',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mongodb: 'MongoDB',
    redis: 'Redis',
    vue: 'Vue',
    django: 'Django',
    laravel: 'Laravel',
  };
  return map[id.toLowerCase()] ?? id;
}

export function createTechnologyDetector(): TechnologyDetector {
  return new TechnologyDetector();
}
