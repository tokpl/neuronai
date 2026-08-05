import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface StackDetection {
  languages: string[];
  frameworks: string[];
  databases: string[];
  packageManagers: string[];
  manifests: string[];
  /** Flat tags for ResolvedProject.stack compatibility */
  stack: string[];
  structureNotes: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function depMap(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...((pkg['dependencies'] as Record<string, string> | undefined) ?? {}),
    ...((pkg['devDependencies'] as Record<string, string> | undefined) ?? {}),
    ...((pkg['peerDependencies'] as Record<string, string> | undefined) ?? {}),
  };
}

function hasDep(deps: Record<string, string>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(deps, name);
}

function versionHint(deps: Record<string, string>, name: string): string | undefined {
  const raw = deps[name];
  if (!raw) return undefined;
  const match = raw.match(/(\d+)/);
  return match?.[1];
}

/**
 * Detect languages, frameworks, databases, and package managers from manifests.
 */
export async function detectProjectStack(root: string): Promise<StackDetection> {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const databases = new Set<string>();
  const packageManagers = new Set<string>();
  const manifests: string[] = [];
  const structureNotes: string[] = [];

  const manifestChecks: Array<{ file: string; onHit: () => void }> = [
    {
      file: 'package.json',
      onHit: () => {
        languages.add('javascript');
      },
    },
    {
      file: 'tsconfig.json',
      onHit: () => {
        languages.add('typescript');
      },
    },
    {
      file: 'composer.json',
      onHit: () => {
        languages.add('php');
        packageManagers.add('composer');
      },
    },
    {
      file: 'Cargo.toml',
      onHit: () => {
        languages.add('rust');
        packageManagers.add('cargo');
      },
    },
    {
      file: 'requirements.txt',
      onHit: () => {
        languages.add('python');
        packageManagers.add('pip');
      },
    },
    {
      file: 'pyproject.toml',
      onHit: () => {
        languages.add('python');
        packageManagers.add('pip');
      },
    },
    {
      file: 'pom.xml',
      onHit: () => {
        languages.add('java');
        packageManagers.add('maven');
      },
    },
    {
      file: 'build.gradle',
      onHit: () => {
        languages.add('java');
        packageManagers.add('gradle');
      },
    },
    {
      file: 'go.mod',
      onHit: () => {
        languages.add('go');
        packageManagers.add('go');
      },
    },
    {
      file: 'pnpm-workspace.yaml',
      onHit: () => {
        packageManagers.add('pnpm');
        structureNotes.push('Monorepo layout detected (pnpm workspace)');
      },
    },
    {
      file: 'pnpm-lock.yaml',
      onHit: () => {
        packageManagers.add('pnpm');
      },
    },
    {
      file: 'yarn.lock',
      onHit: () => {
        packageManagers.add('yarn');
      },
    },
    {
      file: 'package-lock.json',
      onHit: () => {
        packageManagers.add('npm');
      },
    },
    {
      file: 'bun.lockb',
      onHit: () => {
        packageManagers.add('bun');
      },
    },
  ];

  for (const check of manifestChecks) {
    if (await exists(join(root, check.file))) {
      manifests.push(check.file);
      check.onHit();
    }
  }

  if (manifests.includes('package.json') && packageManagers.size === 0) {
    packageManagers.add('npm');
  }

  const pkg = manifests.includes('package.json')
    ? await readJson(join(root, 'package.json'))
    : null;
  const deps = depMap(pkg);

  // Frontend
  if (hasDep(deps, 'next')) {
    frameworks.add('nextjs');
    const major = versionHint(deps, 'next');
    if (major) structureNotes.push(`Project uses Next.js ${major}`);
    else structureNotes.push('Project uses Next.js');
  }
  if (hasDep(deps, 'react') || hasDep(deps, 'react-dom')) frameworks.add('react');
  if (hasDep(deps, 'vue') || hasDep(deps, 'nuxt')) frameworks.add('vue');
  if (hasDep(deps, '@angular/core')) frameworks.add('angular');
  if (hasDep(deps, 'svelte') || hasDep(deps, '@sveltejs/kit')) frameworks.add('svelte');

  // Backend (Node)
  if (hasDep(deps, '@nestjs/core')) frameworks.add('nestjs');
  if (hasDep(deps, 'express')) frameworks.add('express');
  if (hasDep(deps, 'fastify')) frameworks.add('fastify');
  if (hasDep(deps, 'hono')) frameworks.add('hono');

  // PHP / Laravel
  if (manifests.includes('composer.json')) {
    const composer = await readJson(join(root, 'composer.json'));
    const cdeps = {
      ...((composer?.['require'] as Record<string, string> | undefined) ?? {}),
      ...((composer?.['require-dev'] as Record<string, string> | undefined) ?? {}),
    };
    if (hasDep(cdeps, 'laravel/framework')) frameworks.add('laravel');
    if (hasDep(cdeps, 'symfony/framework-bundle')) frameworks.add('symfony');
  }

  // Python / Django
  if (manifests.includes('requirements.txt')) {
    const req = await readFile(join(root, 'requirements.txt'), 'utf8').catch(() => '');
    if (/django/i.test(req)) frameworks.add('django');
    if (/flask/i.test(req)) frameworks.add('flask');
    if (/fastapi/i.test(req)) frameworks.add('fastapi');
    if (/psycopg|postgres/i.test(req)) databases.add('postgresql');
    if (/mysql|pymysql|aiomysql/i.test(req)) databases.add('mysql');
    if (/mongo|pymongo/i.test(req)) databases.add('mongodb');
  }
  if (manifests.includes('pyproject.toml')) {
    const py = await readFile(join(root, 'pyproject.toml'), 'utf8').catch(() => '');
    if (/django/i.test(py)) frameworks.add('django');
    if (/fastapi/i.test(py)) frameworks.add('fastapi');
  }

  // Databases from JS deps / env hints
  if (
    hasDep(deps, 'pg') ||
    hasDep(deps, 'postgres') ||
    hasDep(deps, '@neondatabase/serverless') ||
    hasDep(deps, 'drizzle-orm')
  ) {
    databases.add('postgresql');
  }
  if (hasDep(deps, 'mysql') || hasDep(deps, 'mysql2')) databases.add('mysql');
  if (hasDep(deps, 'mongodb') || hasDep(deps, 'mongoose')) databases.add('mongodb');
  if (hasDep(deps, 'better-sqlite3') || hasDep(deps, 'sqlite3')) databases.add('sqlite');
  if (hasDep(deps, 'ioredis') || hasDep(deps, 'redis')) databases.add('redis');

  // Structure
  if (await exists(join(root, 'apps')) && (await exists(join(root, 'packages')))) {
    structureNotes.push('Architecture contains apps/packages structure');
  }
  if (await exists(join(root, 'src'))) {
    structureNotes.push('Source lives under src/');
  }
  if (await exists(join(root, 'app'))) {
    structureNotes.push('App router / app directory present');
  }

  if (packageManagers.size > 0) {
    structureNotes.push(`Package manager is ${[...packageManagers][0]}`);
  }
  if (databases.size > 0) {
    for (const db of databases) {
      structureNotes.push(`Database is ${db === 'postgresql' ? 'PostgreSQL' : db}`);
    }
  }

  const stack = [
    ...languages,
    ...frameworks,
    ...databases,
    ...[...packageManagers].map((pm) => `pm:${pm}`),
  ];

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    databases: [...databases],
    packageManagers: [...packageManagers],
    manifests,
    stack,
    structureNotes: [...new Set(structureNotes)],
  };
}
