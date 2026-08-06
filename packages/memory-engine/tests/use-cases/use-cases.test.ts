import { describe, expect, it } from 'vitest';

import { createInMemoryMemoryEngine } from '../../src/index.js';

describe('memory use cases', () => {
  it('creates, updates with version history, and archives', async () => {
    const engine = createInMemoryMemoryEngine();
    const projectId = '22222222-2222-2222-2222-222222222222';

    const created = await engine.createMemory({
      projectId,
      type: 'knowledge',
      title: 'State management',
      content: 'Project uses Redux',
      source: 'manual',
    });

    expect(created.version).toBe(1);
    expect(created.importanceScore).toBeGreaterThan(0.5);

    const updated = await engine.updateMemory({
      id: created.id,
      content: 'Project migrated to Zustand',
      reason: 'Migration completed May 2026',
    });
    expect(updated.version).toBe(2);
    expect(updated.content).toContain('Zustand');

    const versions = await engine.versions.listByMemoryId(created.id);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);

    await engine.archiveMemory(created.id);
    const archived = await engine.getMemory(created.id);
    expect(archived.status).toBe('archived');
  });

  it('rejects duplicates', async () => {
    const engine = createInMemoryMemoryEngine();
    const projectId = '22222222-2222-2222-2222-222222222222';
    const input = {
      projectId,
      type: 'pattern' as const,
      title: 'API wrapper',
      content: 'All API responses use a standard wrapper',
      source: 'documentation' as const,
    };
    await engine.createMemory(input);
    await expect(engine.createMemory(input)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('creates relations and project context', async () => {
    const engine = createInMemoryMemoryEngine();
    const projectId = '22222222-2222-2222-2222-222222222222';

    const auth = await engine.createMemory({
      projectId,
      type: 'dependency',
      title: 'Auth module',
      content: 'sky-auth handles authentication',
      source: 'manual',
      manualImportance: 0.9,
    });
    const perms = await engine.createMemory({
      projectId,
      type: 'dependency',
      title: 'Permissions',
      content: 'Permission system provides RBAC',
      source: 'manual',
      manualImportance: 0.85,
    });

    const relation = await engine.createRelation({
      projectId,
      fromMemoryId: auth.id,
      toMemoryId: perms.id,
      relationType: 'depends_on',
    });
    expect(relation.relationType).toBe('depends_on');

    const context = await engine.getProjectMemoryContext({ projectId, limit: 10 });
    expect(context.memories.length).toBeGreaterThanOrEqual(2);
    expect(context.tokenEstimate).toBeGreaterThan(0);
  });

  it('returns no results when no searcher is wired, rather than throwing', async () => {
    const engine = createInMemoryMemoryEngine();
    await expect(engine.searchMemory({ projectId: 'p', query: 'auth' })).resolves.toEqual({
      results: [],
    });
  });
});
