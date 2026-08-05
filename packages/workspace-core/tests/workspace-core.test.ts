import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createWorkspaceCore,
  createStorageProvider,
  createAccessPolicyEngine,
  defaultAccessRules,
} from '../src/index.js';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('workspace tests', () => {
  it('bootstraps company with multiple projects', () => {
    const core = createWorkspaceCore();
    const { organization, workspace, projects } = core.bootstrapCompany({
      companyName: 'Acme',
      projects: [
        { name: 'Backend API' },
        { name: 'Mobile App' },
        { name: 'Website' },
      ],
    });
    expect(organization.name).toBe('Acme');
    expect(workspace.projects).toHaveLength(3);
    expect(projects.map((p) => p.name)).toEqual([
      'Backend API',
      'Mobile App',
      'Website',
    ]);
    const info = core.workspaceInfo();
    expect(info.active.projectName).toBe('Backend API');
  });

  it('switches project context', () => {
    const core = createWorkspaceCore();
    const { projects } = core.bootstrapCompany({
      companyName: 'Acme',
      projects: [{ name: 'A' }, { name: 'B' }],
    });
    const sw = core.switchProject(projects[1]!.id);
    expect(sw.projectName).toBe('B');
    expect(core.workspaceInfo().active.projectId).toBe(projects[1]!.id);
  });
});

describe('permission tests', () => {
  it('VIEWER denied workspace_settings; OWNER allowed', () => {
    const policy = defaultAccessRules('ws_1');
    const engine = createAccessPolicyEngine(policy);
    expect(engine.check('VIEWER', 'workspace_settings').allowed).toBe(false);
    expect(engine.check('OWNER', 'memory').allowed).toBe(true);
    expect(engine.check('MEMBER', 'decisions').allowed).toBe(true);
  });

  it('accessCheck uses active member role', () => {
    const core = createWorkspaceCore();
    const { workspace } = core.bootstrapCompany({
      companyName: 'Acme',
      projects: [{ name: 'API' }],
      owner: { id: 'u1', displayName: 'Owner' },
    });
    core.registry.addMember(workspace.id, {
      id: 'viewer1',
      displayName: 'Viewer',
      role: 'VIEWER',
      joinedAt: new Date().toISOString(),
    });
    const denied = core.accessCheck({
      resource: 'workspace_settings',
      memberId: 'viewer1',
    });
    expect(denied.allowed).toBe(false);
  });
});

describe('storage tests', () => {
  it('scopes records by workspace_id and project_id', async () => {
    const store = createStorageProvider('memory');
    await store.save({
      id: 'm1',
      workspaceId: 'ws1',
      projectId: 'p1',
      collection: 'memory',
      data: { title: 'a' },
      updatedAt: new Date().toISOString(),
    });
    await store.save({
      id: 'm2',
      workspaceId: 'ws1',
      projectId: 'p2',
      collection: 'memory',
      data: { title: 'b' },
      updatedAt: new Date().toISOString(),
    });
    const q = await store.query({ workspaceId: 'ws1', projectId: 'p1' });
    expect(q).toHaveLength(1);
    expect(q[0]!.id).toBe('m1');
    const st = await store.status();
    expect(st.ready).toBe(true);
  });

  it('sqlite/postgres adapters report foundation status', async () => {
    const pg = createStorageProvider('postgres', { databaseUrl: undefined });
    const status = await pg.status();
    expect(status.backend).toBe('postgres');
    expect(status.note).toMatch(/foundation/i);
  });
});

describe('isolation tests', () => {
  it('each project gets distinct memory and graph spaces', () => {
    const core = createWorkspaceCore();
    const { projects } = core.bootstrapCompany({
      companyName: 'Acme',
      projects: [{ name: 'Backend API' }, { name: 'Website' }],
    });
    expect(core.isolation.assertIsolated(projects[0]!, projects[1]!)).toBe(true);
    expect(projects[0]!.isolation.memorySpaceId).not.toBe(
      projects[1]!.isolation.memorySpaceId,
    );
  });

  it('persists workspace.json and resolves MCP context', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'neuron-ws-'));
    dirs.push(dir);
    const core = createWorkspaceCore();
    core.bootstrapCompany({
      companyName: 'Acme',
      projects: [{ name: 'Backend API' }, { name: 'Mobile App' }],
    });
    await core.save(dir);

    const loaded = createWorkspaceCore();
    await loaded.load(dir);
    const ctx = loaded.resolveMcpContext({ projectNameHint: 'Mobile App' });
    expect(ctx.projectName).toBe('Mobile App');
    expect(ctx.permissions.memory).toBe(true);
  });
});
