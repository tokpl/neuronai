import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createGraphEdge,
  createGraphNode,
  createInMemoryGraphRepository,
  createKnowledgeGraph,
  createProjectIntelligenceEngine,
  createTypeScriptAnalyzer,
  PLANNED_MCP_TOOLS,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('graph domain', () => {
  it('creates nodes and relations', async () => {
    const graph = createInMemoryGraphRepository();
    const project = createGraphNode({
      projectId: 'p1',
      type: 'PROJECT',
      name: 'SkyGaming',
    });
    const auth = createGraphNode({
      projectId: 'p1',
      type: 'MODULE',
      name: 'sky-auth',
      path: 'src/auth',
    });
    const ui = createGraphNode({
      projectId: 'p1',
      type: 'MODULE',
      name: 'sky-ui',
      path: 'src/ui',
    });
    await graph.upsertNode(project);
    await graph.upsertNode(auth);
    await graph.upsertNode(ui);
    await graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: auth.id,
        toNodeId: ui.id,
        relationType: 'DEPENDS_ON',
      }),
    );

    const edges = await graph.findEdges({ projectId: 'p1', fromNodeId: auth.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]!.relationType).toBe('DEPENDS_ON');
  });

  it('createKnowledgeGraph neighbors works after seeding', async () => {
    const kg = createKnowledgeGraph('p1');
    const a = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'a' });
    const b = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'b' });
    await kg.graph.upsertNode(a);
    await kg.graph.upsertNode(b);
    await kg.graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: a.id,
        toNodeId: b.id,
        relationType: 'AFFECTS',
      }),
    );
    const neighbors = await kg.neighbors(a.id, 1);
    expect(neighbors.some((n) => n.id === b.id)).toBe(true);
  });
});

describe('TypeScriptAnalyzer', () => {
  it('extracts imports', () => {
    const analysis = createTypeScriptAnalyzer().analyze(
      'src/auth.ts',
      `import { db } from './database';\nexport function login() {}`,
    );
    expect(analysis.imports.some((i) => i.specifier === './database')).toBe(true);
    expect(analysis.exports.some((e) => e.name === 'login')).toBe(true);
  });
});

describe('ProjectIntelligenceEngine', () => {
  it('discovers dependencies and builds impact for auth', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-kg-'));
    temps.push(root);

    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'sky-gaming',
        dependencies: { next: '16.0.0', zod: '3.0.0' },
      }),
      'utf8',
    );
    await mkdir(join(root, 'src', 'auth'), { recursive: true });
    await mkdir(join(root, 'src', 'admin'), { recursive: true });
    await writeFile(
      join(root, 'src', 'auth', 'PermissionService.ts'),
      `import { db } from '../database';\nexport class PermissionService {}\n`,
      'utf8',
    );
    await writeFile(join(root, 'src', 'database.ts'), `export const db = {};\n`, 'utf8');
    await writeFile(
      join(root, 'src', 'admin', 'panel.ts'),
      `import { PermissionService } from '../auth/PermissionService';\nexport const panel = true;\n`,
      'utf8',
    );

    const engine = createProjectIntelligenceEngine();
    const result = await engine.analyzeProject(root);

    await engine.memories.linkMemories(result.project.projectId, [
      {
        id: 'm1',
        projectId: result.project.projectId,
        type: 'architecture_decision',
        title: 'JWT selected instead of sessions',
        content: 'Auth uses JWT middleware; do not bypass PermissionService',
        importanceScore: 0.9,
        confidenceScore: 0.9,
        freshnessScore: 1,
        source: 'manual',
        status: 'active',
        version: 1,
        tags: ['auth', 'permissions'],
        usageCount: 0,
        lastUsedAt: null,
        embeddingId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    expect(result.stats.dependencies).toBeGreaterThan(0);
    expect(result.stats.modules).toBeGreaterThan(0);
    expect(result.export.nodes.length).toBeGreaterThan(0);
    expect(result.export.edges.length).toBeGreaterThan(0);

    const impact = await engine.impactAnalysis(result.project.projectId, 'PermissionService');
    expect(impact).not.toBeNull();
    expect(impact!.impactScore).toBeGreaterThan(0);
    expect(impact!.summary.length).toBeGreaterThan(0);

    const answer = await engine.ask(
      result.project.projectId,
      'What depends on PermissionService?',
    );
    expect(answer.answer.length).toBeGreaterThan(0);

    expect(PLANNED_MCP_TOOLS.map((t) => t.name)).toContain('neuron_impact_analysis');
  });
});
