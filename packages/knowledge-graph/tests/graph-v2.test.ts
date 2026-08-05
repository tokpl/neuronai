import { describe, expect, it } from 'vitest';

import {
  createGraphEdge,
  createGraphNode,
  createGraphReasoner,
  createInMemoryGraphRepository,
  createImpactAnalyzer,
  createNodeImportanceScorer,
  createProjectIntelligenceEngine,
} from '../src/index.js';

describe('graph 2.0 creation', () => {
  it('supports new node and relation types', async () => {
    const graph = createInMemoryGraphRepository();
    const auth = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'AuthService' });
    const decision = createGraphNode({
      projectId: 'p1',
      type: 'DECISION',
      name: 'Centralize JWT config',
    });
    const incident = createGraphNode({
      projectId: 'p1',
      type: 'INCIDENT',
      name: 'Random logout',
    });
    await graph.upsertNode(auth);
    await graph.upsertNode(decision);
    await graph.upsertNode(incident);
    await graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: incident.id,
        toNodeId: auth.id,
        relationType: 'CAUSED',
      }),
    );
    await graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: decision.id,
        toNodeId: auth.id,
        relationType: 'DOCUMENTS',
      }),
    );
    const edges = await graph.findEdges({ projectId: 'p1', toNodeId: auth.id });
    expect(edges.some((e) => e.relationType === 'CAUSED')).toBe(true);
    expect(edges.some((e) => e.relationType === 'DOCUMENTS')).toBe(true);
  });
});

describe('graph query / reasoner', () => {
  it('builds an impact map for authentication', async () => {
    const graph = createInMemoryGraphRepository();
    const auth = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'AuthService' });
    const users = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'User Model' });
    const perms = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'Permissions' });
    const db = createGraphNode({ projectId: 'p1', type: 'DATABASE_TABLE', name: 'users' });
    for (const n of [auth, users, perms, db]) await graph.upsertNode(n);
    await graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: auth.id,
        toNodeId: users.id,
        relationType: 'DEPENDS_ON',
      }),
    );
    await graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: users.id,
        toNodeId: perms.id,
        relationType: 'RELATED_TO',
      }),
    );
    await graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: perms.id,
        toNodeId: db.id,
        relationType: 'USES',
      }),
    );

    const map = await createGraphReasoner(graph).reason('p1', 'What affects authentication?');
    expect(map.seed?.name).toMatch(/Auth/i);
    expect(map.steps.length).toBeGreaterThan(0);
    expect(map.summary).toMatch(/Impact map/i);
  });
});

describe('impact analysis', () => {
  it('lists modules affected by User entity change', async () => {
    const graph = createInMemoryGraphRepository();
    const user = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'User entity' });
    const auth = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'Auth' });
    const billing = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'Billing' });
    const profiles = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'Profiles' });
    const permissions = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'Permissions' });
    for (const n of [user, auth, billing, profiles, permissions]) await graph.upsertNode(n);
    for (const dep of [auth, billing, profiles, permissions]) {
      await graph.upsertEdge(
        createGraphEdge({
          projectId: 'p1',
          fromNodeId: dep.id,
          toNodeId: user.id,
          relationType: 'DEPENDS_ON',
        }),
      );
    }
    const report = await createImpactAnalyzer(graph).analyze('p1', 'User entity');
    expect(report).toBeTruthy();
    expect(report!.affected.length).toBeGreaterThanOrEqual(3);
    expect(report!.summary).toMatch(/affect/i);
  });
});

describe('ranking', () => {
  it('scores highly connected auth higher than leaf file', async () => {
    const graph = createInMemoryGraphRepository();
    const auth = createGraphNode({ projectId: 'p1', type: 'SERVICE', name: 'Auth' });
    const leaf = createGraphNode({
      projectId: 'p1',
      type: 'FILE',
      name: 'readme.md',
      path: 'README.md',
    });
    const other = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'UI' });
    await graph.upsertNode(auth);
    await graph.upsertNode(leaf);
    await graph.upsertNode(other);
    await graph.upsertEdge(
      createGraphEdge({
        projectId: 'p1',
        fromNodeId: other.id,
        toNodeId: auth.id,
        relationType: 'DEPENDS_ON',
      }),
    );
    const scores = await createNodeImportanceScorer(graph).scoreProject('p1');
    const authScore = scores.find((s) => s.name === 'Auth')!.score;
    const leafScore = scores.find((s) => s.name === 'readme.md')!.score;
    expect(authScore).toBeGreaterThan(leafScore);
  });
});

describe('project map facade', () => {
  it('exports graph stats via ProjectIntelligenceEngine', async () => {
    const eng = createProjectIntelligenceEngine();
    const a = createGraphNode({ projectId: 'p1', type: 'MODULE', name: 'Core' });
    await eng.graph.upsertNode(a);
    const map = await eng.projectMap('p1', 'demo');
    expect(map.stats.nodes).toBeGreaterThanOrEqual(1);
    expect(map.export.version).toBe(1);
  });
});
