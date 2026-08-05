import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

import { createGraphChange } from '../domain/entities/graph-change.js';
import { createGraphEdge } from '../domain/entities/graph-edge.js';
import { createGraphNode } from '../domain/entities/graph-node.js';
import type { GraphRepository } from '../repositories/graph-repository.js';
import {
  JavaAnalyzer,
  PHPAnalyzer,
  PythonAnalyzer,
} from './language-stubs.js';
import { pickAnalyzer, type LanguageAnalyzer } from './language-analyzer.js';
import { createTypeScriptAnalyzer } from './typescript-analyzer.js';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.neuron',
  'vendor',
  'target',
  '.turbo',
]);

async function walkFiles(root: string, maxFiles = 400): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (out.length >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }

  await walk(root);
  return out;
}

function moduleNameFromPath(rel: string): string {
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts[0] === 'apps' || parts[0] === 'packages' || parts[0] === 'src') {
    return parts.slice(0, Math.min(2, parts.length)).join('/');
  }
  return parts[0] ?? 'root';
}

function resolveImportPath(fromFile: string, specifier: string, root: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, 'index.ts'),
    join(base, 'index.js'),
  ];
  // We don't fs-stat all here during graph build — normalize relative path guess
  const preferred = candidates[1] ?? base;
  const rel = relative(root, preferred).replace(/\\/g, '/');
  return rel.startsWith('..') ? null : rel;
}

/**
 * Builds FILE / MODULE / SERVICE / COMPONENT nodes and IMPORTS / DEPENDS_ON edges from source.
 */
export class CodeGraphAnalyzer {
  private readonly analyzers: LanguageAnalyzer[];

  constructor(
    private readonly graph: GraphRepository,
    analyzers?: LanguageAnalyzer[],
  ) {
    this.analyzers =
      analyzers ??
      [
        createTypeScriptAnalyzer(),
        new PHPAnalyzer(),
        new PythonAnalyzer(),
        new JavaAnalyzer(),
      ];
  }

  async analyze(input: {
    projectId: string;
    rootPath: string;
    projectNodeId: string;
  }): Promise<{ files: number; edges: number; modules: number }> {
    const files = await walkFiles(input.rootPath);
    const fileNodeByRel = new Map<string, string>();
    const moduleNodeByName = new Map<string, string>();
    let edgeCount = 0;

    for (const abs of files) {
      const analyzer = pickAnalyzer(this.analyzers, abs);
      if (!analyzer) continue;

      const rel = relative(input.rootPath, abs).replace(/\\/g, '/');
      let source = '';
      try {
        source = await readFile(abs, 'utf8');
      } catch {
        continue;
      }
      if (source.length > 400_000) continue;

      const analysis = analyzer.analyze(abs, source);
      const moduleName = moduleNameFromPath(rel);

      let moduleId = moduleNodeByName.get(moduleName);
      if (!moduleId) {
        const moduleNode = createGraphNode({
          projectId: input.projectId,
          type: 'MODULE',
          name: moduleName,
          path: moduleName,
          metadata: {},
        });
        await this.graph.upsertNode(moduleNode);
        moduleNodeByName.set(moduleName, moduleNode.id);
        moduleId = moduleNode.id;
        await this.graph.upsertEdge(
          createGraphEdge({
            projectId: input.projectId,
            fromNodeId: moduleNode.id,
            toNodeId: input.projectNodeId,
            relationType: 'OWNED_BY',
          }),
        );
      }

      const fileNode = createGraphNode({
        projectId: input.projectId,
        type: 'FILE',
        name: rel.split('/').pop() ?? rel,
        path: rel,
        metadata: {
          language: analysis.language,
          exports: analysis.exports.map((e) => e.name),
        },
      });
      await this.graph.upsertNode(fileNode);
      fileNodeByRel.set(rel, fileNode.id);
      fileNodeByRel.set(stripExt(rel), fileNode.id);

      await this.graph.upsertEdge(
        createGraphEdge({
          projectId: input.projectId,
          fromNodeId: fileNode.id,
          toNodeId: moduleId,
          relationType: 'OWNED_BY',
        }),
      );

      if (analysis.hints.isService) {
        const svc = createGraphNode({
          projectId: input.projectId,
          type: 'SERVICE',
          name: fileNode.name.replace(/\.[^.]+$/, ''),
          path: rel,
          metadata: { fromFile: rel },
        });
        await this.graph.upsertNode(svc);
        await this.graph.upsertEdge(
          createGraphEdge({
            projectId: input.projectId,
            fromNodeId: svc.id,
            toNodeId: fileNode.id,
            relationType: 'RELATED_TO',
          }),
        );
      }

      if (analysis.hints.isComponent) {
        const comp = createGraphNode({
          projectId: input.projectId,
          type: 'COMPONENT',
          name: fileNode.name.replace(/\.[^.]+$/, ''),
          path: rel,
        });
        await this.graph.upsertNode(comp);
      }

      if (analysis.hints.isApiEndpoint) {
        const api = createGraphNode({
          projectId: input.projectId,
          type: 'API_ENDPOINT',
          name: rel,
          path: rel,
        });
        await this.graph.upsertNode(api);
      }

      for (const table of analysis.hints.tableNames ?? []) {
        const t = createGraphNode({
          projectId: input.projectId,
          type: 'DATABASE_TABLE',
          name: table,
          metadata: { referencedFrom: rel },
        });
        await this.graph.upsertNode(t);
        await this.graph.upsertEdge(
          createGraphEdge({
            projectId: input.projectId,
            fromNodeId: fileNode.id,
            toNodeId: t.id,
            relationType: 'USES',
          }),
        );
        edgeCount += 1;
      }

      for (const imp of analysis.imports) {
        if (imp.isExternal) {
          // Link file → dependency node by name when present
          const deps = await this.graph.findNodes({
            projectId: input.projectId,
            type: 'DEPENDENCY',
            name: imp.specifier.startsWith('@')
              ? imp.specifier.split('/').slice(0, 2).join('/')
              : imp.specifier.split('/')[0],
          });
          const dep = deps[0];
          if (dep) {
            await this.graph.upsertEdge(
              createGraphEdge({
                projectId: input.projectId,
                fromNodeId: fileNode.id,
                toNodeId: dep.id,
                relationType: 'USES',
              }),
            );
            edgeCount += 1;
          }
          continue;
        }

        const resolved = resolveImportPath(abs, imp.specifier, input.rootPath);
        if (!resolved) continue;
        // Will link in second pass when target file node exists
        (fileNode.metadata as { pendingImports?: string[] }).pendingImports = [
          ...(((fileNode.metadata as { pendingImports?: string[] }).pendingImports) ?? []),
          resolved,
        ];
        await this.graph.upsertNode(fileNode);
      }
    }

    // Second pass: wire IMPORTS / DEPENDS_ON between files & modules
    const allFiles = await this.graph.findNodes({
      projectId: input.projectId,
      type: 'FILE',
    });
    for (const file of allFiles) {
      const pending = (file.metadata as { pendingImports?: string[] }).pendingImports ?? [];
      for (const targetRel of pending) {
        const targetId =
          fileNodeByRel.get(normalizeRel(targetRel)) ??
          fileNodeByRel.get(stripExt(normalizeRel(targetRel)));
        if (!targetId || targetId === file.id) continue;

        await this.graph.upsertEdge(
          createGraphEdge({
            projectId: input.projectId,
            fromNodeId: file.id,
            toNodeId: targetId,
            relationType: 'IMPORTS',
          }),
        );
        await this.graph.upsertEdge(
          createGraphEdge({
            projectId: input.projectId,
            fromNodeId: file.id,
            toNodeId: targetId,
            relationType: 'DEPENDS_ON',
          }),
        );
        edgeCount += 2;

        // Module-level DEPENDS_ON
        const fromMod = await moduleIdForFile(this.graph, input.projectId, file.id);
        const toMod = await moduleIdForFile(this.graph, input.projectId, targetId);
        if (fromMod && toMod && fromMod !== toMod) {
          await this.graph.upsertEdge(
            createGraphEdge({
              projectId: input.projectId,
              fromNodeId: fromMod,
              toNodeId: toMod,
              relationType: 'DEPENDS_ON',
            }),
          );
          await this.graph.upsertEdge(
            createGraphEdge({
              projectId: input.projectId,
              fromNodeId: fromMod,
              toNodeId: toMod,
              relationType: 'AFFECTS',
              metadata: { derived: true },
            }),
          );
          edgeCount += 2;
        }
      }
    }

    await this.graph.appendChange(
      createGraphChange({
        projectId: input.projectId,
        kind: 'snapshot',
        entityId: input.projectNodeId,
        summary: `Code graph: ${allFiles.length} files, ${moduleNodeByName.size} modules`,
      }),
    );

    return {
      files: allFiles.length,
      edges: edgeCount,
      modules: moduleNodeByName.size,
    };
  }
}

function stripExt(p: string): string {
  return p.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, '');
}

function normalizeRel(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function moduleIdForFile(
  graph: GraphRepository,
  projectId: string,
  fileId: string,
): Promise<string | null> {
  const edges = await graph.findEdges({
    projectId,
    fromNodeId: fileId,
    relationType: 'OWNED_BY',
  });
  return edges[0]?.toNodeId ?? null;
}

export function createCodeGraphAnalyzer(graph: GraphRepository): CodeGraphAnalyzer {
  return new CodeGraphAnalyzer(graph);
}
