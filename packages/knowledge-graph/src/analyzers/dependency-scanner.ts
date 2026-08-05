import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createGraphEdge } from '../domain/entities/graph-edge.js';
import { createGraphNode } from '../domain/entities/graph-node.js';
import type { GraphRepository } from '../repositories/graph-repository.js';
import { createGraphChange } from '../domain/entities/graph-change.js';

export interface ScannedDependency {
  name: string;
  version?: string;
  manager: string;
  manifest: string;
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Discovers third-party libraries from package manifests and writes DEPENDENCY nodes.
 */
export class DependencyScanner {
  constructor(private readonly graph: GraphRepository) {}

  async scan(input: {
    projectId: string;
    rootPath: string;
    projectNodeId: string;
  }): Promise<ScannedDependency[]> {
    const found: ScannedDependency[] = [];

    const pkgText = await readOptional(join(input.rootPath, 'package.json'));
    if (pkgText) {
      const pkg = JSON.parse(pkgText) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const [name, version] of Object.entries({
        ...pkg.dependencies,
        ...pkg.devDependencies,
      })) {
        found.push({ name, version, manager: 'npm', manifest: 'package.json' });
      }
    }

    const composerText = await readOptional(join(input.rootPath, 'composer.json'));
    if (composerText) {
      const composer = JSON.parse(composerText) as {
        require?: Record<string, string>;
        'require-dev'?: Record<string, string>;
      };
      for (const [name, version] of Object.entries({
        ...(composer.require ?? {}),
        ...(composer['require-dev'] ?? {}),
      })) {
        if (name === 'php') continue;
        found.push({ name, version, manager: 'composer', manifest: 'composer.json' });
      }
    }

    const req = await readOptional(join(input.rootPath, 'requirements.txt'));
    if (req) {
      for (const line of req.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const name = trimmed.split(/[=<>!~]/)[0]?.trim();
        if (name) found.push({ name, manager: 'pip', manifest: 'requirements.txt' });
      }
    }

    const pom = await readOptional(join(input.rootPath, 'pom.xml'));
    if (pom) {
      const artifactRe = /<artifactId>([^<]+)<\/artifactId>/g;
      let m: RegExpExecArray | null;
      while ((m = artifactRe.exec(pom)) !== null) {
        found.push({ name: m[1]!, manager: 'maven', manifest: 'pom.xml' });
      }
    }

    const cargo = await readOptional(join(input.rootPath, 'Cargo.toml'));
    if (cargo) {
      const depsSection = cargo.split(/\[dependencies\]/)[1]?.split(/\[/)[0] ?? '';
      for (const line of depsSection.split(/\r?\n/)) {
        const name = line.match(/^([A-Za-z0-9_-]+)\s*=/)?.[1];
        if (name) found.push({ name, manager: 'cargo', manifest: 'Cargo.toml' });
      }
    }

    for (const dep of found) {
      const node = createGraphNode({
        projectId: input.projectId,
        type: 'DEPENDENCY',
        name: dep.name,
        metadata: { version: dep.version, manager: dep.manager, manifest: dep.manifest },
      });
      await this.graph.upsertNode(node);
      await this.graph.upsertEdge(
        createGraphEdge({
          projectId: input.projectId,
          fromNodeId: input.projectNodeId,
          toNodeId: node.id,
          relationType: 'USES',
          metadata: { kind: 'library' },
        }),
      );
    }

    if (found.length > 0) {
      await this.graph.appendChange(
        createGraphChange({
          projectId: input.projectId,
          kind: 'snapshot',
          entityId: input.projectNodeId,
          summary: `Scanned ${found.length} dependencies`,
        }),
      );
    }

    return found;
  }
}

export function createDependencyScanner(graph: GraphRepository): DependencyScanner {
  return new DependencyScanner(graph);
}
