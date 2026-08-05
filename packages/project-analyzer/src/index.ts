import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import type { ProjectRecord } from '@neuronai/types';

import { detectProjectStack, type StackDetection } from './detect-stack.js';

export type { StackDetection } from './detect-stack.js';
export { detectProjectStack } from './detect-stack.js';
export {
  collectProjectSignals,
  type ProjectSignals,
} from './project-signals.js';

export interface ResolvedProject {
  rootPath: string;
  name: string;
  slug: string;
  projectId: string;
  stack: string[];
  languages: string[];
  frameworks: string[];
  databases: string[];
  packageManagers: string[];
  structureNotes: string[];
  git: boolean;
  manifests: string[];
}

export interface ProjectResolver {
  resolve(rootPath?: string): Promise<ResolvedProject>;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'project'
  );
}

/** Deterministic UUID-shaped id from a slug (stable across runs). */
export function projectIdFromSlug(slug: string): string {
  const hash = createHash('sha256').update(`neuron:${slug}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export class FilesystemProjectResolver implements ProjectResolver {
  async resolve(rootPath = process.cwd()): Promise<ResolvedProject> {
    const root = resolve(rootPath);
    let name = basename(root);

    if (await exists(join(root, 'package.json'))) {
      try {
        const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
          name?: string;
        };
        if (pkg.name) name = pkg.name.replace(/^@[^/]+\//, '');
      } catch {
        // keep basename
      }
    }

    const slug = slugify(name);
    const detection: StackDetection = await detectProjectStack(root);
    const git = await exists(join(root, '.git'));

    await readdir(root).catch(() => undefined);

    return {
      rootPath: root,
      name,
      slug,
      projectId: projectIdFromSlug(slug),
      stack: detection.stack,
      languages: detection.languages,
      frameworks: detection.frameworks,
      databases: detection.databases,
      packageManagers: detection.packageManagers,
      structureNotes: detection.structureNotes,
      git,
      manifests: detection.manifests,
    };
  }
}

export function createProjectResolver(): ProjectResolver {
  return new FilesystemProjectResolver();
}

export function toProjectRecord(resolved: ResolvedProject): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: resolved.projectId,
    slug: resolved.slug,
    name: resolved.name,
    type: 'application',
    stack: resolved.stack,
    createdAt: now,
    updatedAt: now,
  };
}

/** Human-readable knowledge candidates from analysis (for Memory Intelligence filtering). */
export function buildProjectKnowledgeCandidates(project: ResolvedProject): Array<{
  title: string;
  content: string;
  type: 'knowledge' | 'dependency' | 'context';
}> {
  const candidates: Array<{
    title: string;
    content: string;
    type: 'knowledge' | 'dependency' | 'context';
  }> = [];

  for (const note of project.structureNotes) {
    candidates.push({
      title: note.slice(0, 80),
      content: note,
      type: note.toLowerCase().includes('architecture') ? 'knowledge' : 'knowledge',
    });
  }

  if (project.frameworks.length > 0) {
    candidates.push({
      title: `Frameworks: ${project.frameworks.join(', ')}`,
      content: `Detected frameworks: ${project.frameworks.join(', ')}. Languages: ${project.languages.join(', ') || 'unknown'}.`,
      type: 'dependency',
    });
  }

  if (project.databases.length > 0) {
    candidates.push({
      title: `Databases: ${project.databases.join(', ')}`,
      content: `Project appears to use: ${project.databases.join(', ')}.`,
      type: 'dependency',
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      title: `Project ${project.name}`,
      content: `Project root at ${project.rootPath}. Manifests: ${project.manifests.join(', ') || 'none detected'}.`,
      type: 'context',
    });
  }

  return candidates;
}
