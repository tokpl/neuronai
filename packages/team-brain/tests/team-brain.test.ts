import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createKnowledgePermissions,
  createKnowledgeSyncProvider,
  createTeamBrain,
  createTeamKnowledgeConflictResolver,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const d of temps.splice(0)) {
    await rm(d, { recursive: true, force: true });
  }
});

async function tempBrain() {
  const dir = await mkdtemp(join(tmpdir(), 'neuron-tb-'));
  temps.push(dir);
  const brain = createTeamBrain({
    neuronDir: dir,
    projectId: 'proj_1',
    teamName: 'Demo Team',
  });
  await brain.load();
  await brain.upsertMember({
    id: 'senior',
    displayName: 'Senior Developer',
    role: 'owner',
    teamId: 'team_demo',
  });
  await brain.upsertMember({
    id: 'junior',
    displayName: 'New Developer',
    role: 'viewer',
    teamId: 'team_demo',
  });
  await brain.upsertMember({
    id: 'reviewer',
    displayName: 'Reviewer',
    role: 'reviewer',
    teamId: 'team_demo',
  });
  return brain;
}

describe('permissions', () => {
  it('maps roles to VIEW/SUGGEST/APPROVE/ADMIN', () => {
    const p = createKnowledgePermissions();
    expect(p.levelFromRole('viewer')).toBe('VIEW');
    expect(p.levelFromRole('contributor')).toBe('SUGGEST');
    expect(p.levelFromRole('reviewer')).toBe('APPROVE');
    expect(p.levelFromRole('owner')).toBe('ADMIN');
    expect(p.can('SUGGEST', 'VIEW')).toBe(true);
    expect(p.can('VIEW', 'APPROVE')).toBe(false);
  });

  it('denies viewer from suggesting', async () => {
    const brain = await tempBrain();
    await expect(
      brain.proposeSharedMemory(
        { actorId: 'junior', role: 'viewer' },
        { title: 'x', content: 'y' },
      ),
    ).rejects.toThrow(/Permission denied/);
  });
});

describe('approval', () => {
  it('propose → REVIEW → approve → APPROVED', async () => {
    const brain = await tempBrain();
    const drafted = await brain.proposeSharedMemory(
      { actorId: 'senior', role: 'owner' },
      {
        title: 'Use PostgreSQL',
        content: 'Primary OLTP store is PostgreSQL.',
        type: 'architecture_decision',
      },
    );
    expect(drafted.status).toBe('REVIEW');
    expect(drafted.ownership.creator).toBe('senior');

    const approved = await brain.approveSharedMemory(
      { actorId: 'reviewer', role: 'reviewer' },
      drafted.id,
    );
    expect(approved.status).toBe('APPROVED');
    expect(approved.ownership.approvedBy).toBe('reviewer');

    const audit = brain.recentAudit();
    expect(audit.some((a) => a.action === 'Memory created')).toBe(true);
    expect(audit.some((a) => a.action === 'Memory approved')).toBe(true);
  });
});

describe('conflicts', () => {
  it('detects REST vs GraphQL conflict', async () => {
    const brain = await tempBrain();
    await brain.proposeSharedMemory(
      { actorId: 'senior', role: 'owner' },
      { title: 'Use REST', content: 'API style: REST', tags: ['api'] },
    );
    const gql = await brain.proposeSharedMemory(
      { actorId: 'senior', role: 'owner' },
      { title: 'Use GraphQL', content: 'API style: GraphQL', tags: ['api'] },
    );
    await brain.approveSharedMemory({ actorId: 'reviewer', role: 'reviewer' }, gql.id);

    const conflict = brain.detectConflict('API');
    expect(conflict).not.toBeNull();
    expect(conflict!.optionA.title).toMatch(/REST|GraphQL/);
    expect(conflict!.recommendation.length).toBeGreaterThan(10);
  });

  it('resolver returns null with single memory', () => {
    const resolver = createTeamKnowledgeConflictResolver();
    expect(
      resolver.detect(
        {
          version: 1,
          projectId: 'p',
          teamId: 't',
          teamName: 't',
          actors: [],
          memories: [],
          contributions: [],
          audit: [],
          graph: { nodes: [], edges: [] },
          updatedAt: new Date().toISOString(),
        },
        'api',
      ),
    ).toBeNull();
  });
});

describe('sync', () => {
  it('local_only never shares', async () => {
    const sync = createKnowledgeSyncProvider('local_only');
    const result = await sync.push({
      version: 1,
      brain: {
        id: 't',
        name: 't',
        projects: [],
        members: [],
        sharedKnowledge: [],
        permissions: ['VIEW'],
        createdAt: new Date().toISOString(),
      },
      audit: [],
      syncMode: 'local_only',
      updatedAt: new Date().toISOString(),
    });
    expect(result.shared).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('cloud_future is blocked', async () => {
    const sync = createKnowledgeSyncProvider('cloud_future');
    const result = await sync.pull();
    expect(result.ok).toBe(false);
    expect(result.shared).toBe(false);
  });
});

describe('onboarding + audit', () => {
  it('new developer mode returns introduction pack', async () => {
    const brain = await tempBrain();
    const mem = await brain.proposeSharedMemory(
      { actorId: 'senior', role: 'owner' },
      {
        title: 'Modular monolith',
        content: 'Architecture: modular monolith with clear module boundaries.',
        type: 'architecture_decision',
      },
    );
    await brain.approveSharedMemory({ actorId: 'reviewer', role: 'reviewer' }, mem.id);

    const pack = await brain.onboarding('junior');
    expect(pack.projectIntroduction).toMatch(/Welcome/);
    expect(pack.markdown).toMatch(/New developer mode/);

    const ctx = await brain.teamContext('payments', 'junior');
    expect(ctx.note).toMatch(/Local-first/);

    const rules = await brain.teamRules();
    expect(Array.isArray(rules)).toBe(true);

    const timeline = await brain.engineeringTimeline();
    expect(timeline.events.length).toBeGreaterThan(0);
  });
});
