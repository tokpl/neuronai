import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';

import {
  createPermissionGate,
  createDecisionReviewWorkflow,
  createMemoryAuditLog,
  createTeamMemoryService,
  emptyTeamDocument,
  describeScope,
  MEMORY_SCOPES,
  type LocalActor,
} from '../src/index.js';

const contributor: LocalActor = {
  id: 'dev-a',
  displayName: 'Dev A',
  role: 'contributor',
  teamId: 'team-1',
};

const reviewer: LocalActor = {
  id: 'dev-b',
  displayName: 'Dev B',
  role: 'reviewer',
  teamId: 'team-1',
};

const viewer: LocalActor = {
  id: 'dev-c',
  displayName: 'Dev C',
  role: 'viewer',
  teamId: 'team-1',
};

describe('memory scopes', () => {
  it('defines four scopes with descriptions', () => {
    expect(MEMORY_SCOPES).toEqual(['PERSONAL', 'PROJECT', 'TEAM', 'ORGANIZATION']);
    for (const s of MEMORY_SCOPES) {
      expect(describeScope(s).length).toBeGreaterThan(10);
    }
  });
});

describe('permissions', () => {
  const gate = createPermissionGate();

  it('allows contributor write on PROJECT but not approve', () => {
    expect(
      gate.can({ scope: 'PROJECT', action: 'write', role: 'contributor', actorId: 'a' }),
    ).toBe(true);
    expect(
      gate.can({ scope: 'PROJECT', action: 'approve', role: 'contributor', actorId: 'a' }),
    ).toBe(false);
  });

  it('blocks viewer write', () => {
    expect(
      gate.can({ scope: 'PROJECT', action: 'write', role: 'viewer', actorId: 'v' }),
    ).toBe(false);
  });

  it('enforces PERSONAL ownerOnly', () => {
    expect(
      gate.can({
        scope: 'PERSONAL',
        action: 'read',
        role: 'reviewer',
        actorId: 'other',
        ownerId: 'owner',
      }),
    ).toBe(false);
    expect(
      gate.can({
        scope: 'PERSONAL',
        action: 'read',
        role: 'contributor',
        actorId: 'owner',
        ownerId: 'owner',
      }),
    ).toBe(true);
  });
});

describe('decision approval workflow', () => {
  it('proposes PROJECT decision as pending_review then activates on approve', () => {
    const wf = createDecisionReviewWorkflow();
    let doc = emptyTeamDocument({
      projectId: 'p1',
      teamId: 'team-1',
      actors: [contributor, reviewer],
    });

    const proposed = wf.propose(doc, contributor, {
      title: 'Use Postgres',
      content: 'Decision: Moved to PostgreSQL',
      scope: 'PROJECT',
    });
    expect(proposed.memory.status).toBe('pending_review');
    doc = proposed.doc;

    const approved = wf.approve(doc, reviewer, proposed.memory.id);
    expect(approved.memory.status).toBe('active');
    expect(approved.memory.approvedBy).toBe(reviewer.id);
    expect(approved.doc.audit.some((a) => a.action === 'approve')).toBe(true);
    expect(approved.doc.contributions.some((c) => c.action === 'approved')).toBe(true);
    expect(
      approved.doc.graph.edges.some(
        (e) => e.relation === 'APPROVED_BY' && e.toNodeId === `dev:${reviewer.id}`,
      ),
    ).toBe(true);
  });

  it('rejects viewer proposing shared decisions', () => {
    const wf = createDecisionReviewWorkflow();
    const doc = emptyTeamDocument({
      projectId: 'p1',
      actors: [viewer],
    });
    expect(() =>
      wf.propose(doc, viewer, { title: 'X', content: 'Y', scope: 'PROJECT' }),
    ).toThrow(/Permission denied/);
  });

  it('auto-activates PERSONAL notes', () => {
    const wf = createDecisionReviewWorkflow();
    const doc = emptyTeamDocument({ projectId: 'p1', actors: [contributor] });
    const { memory } = wf.propose(doc, contributor, {
      title: 'Scratch',
      content: 'private note',
      scope: 'PERSONAL',
    });
    expect(memory.status).toBe('active');
  });
});

describe('audit', () => {
  it('records create and approve trail', () => {
    const audit = createMemoryAuditLog();
    let doc = emptyTeamDocument({ projectId: 'p1' });
    doc = audit.append(doc, {
      memoryId: 'm1',
      actorId: 'a',
      action: 'create',
      scope: 'PROJECT',
    });
    doc = audit.append(doc, {
      memoryId: 'm1',
      actorId: 'b',
      action: 'approve',
      scope: 'PROJECT',
    });
    expect(audit.forMemory(doc, 'm1').map((e) => e.action)).toEqual(['create', 'approve']);
  });
});

describe('team memory service', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it('runs onboarding and team retrieval locally', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'neuron-team-'));
    dirs.push(dir);
    const svc = createTeamMemoryService({ neuronDir: dir, projectId: 'proj-1', teamName: 'Core' });
    await svc.upsertActor(contributor);
    await svc.upsertActor(reviewer);

    const proposed = await svc.proposeDecision(
      { actorId: contributor.id },
      {
        title: 'Event-driven payments',
        content: 'Decision: Use outbox for payments',
        type: 'architecture_decision',
        scope: 'PROJECT',
        tags: ['payments'],
      },
    );
    await svc.approveDecision({ actorId: reviewer.id }, proposed.memory.id);

    await svc.proposeDecision(
      { actorId: contributor.id },
      {
        title: 'Do not access DB from controllers',
        content: 'Mistake: bypassing packages/db caused incidents',
        type: 'mistake',
        scope: 'PROJECT',
      },
    ).then(async (r) => svc.approveDecision({ actorId: reviewer.id }, r.memory.id));

    const pack = await svc.onboardingPack({ actorId: contributor.id });
    expect(pack.markdown).toMatch(/Architecture overview/i);
    expect(pack.importantDecisions.length).toBeGreaterThan(0);

    const ctx = await svc.teamContext('payments outbox', { actorId: contributor.id });
    expect(ctx.hits.length).toBeGreaterThan(0);
    expect(ctx.hits[0]!.memory.title).toMatch(/payments/i);

    const history = await svc.decisionHistory();
    expect(history.some((h) => h.status === 'active')).toBe(true);

    const contributors = await svc.contributors();
    expect(contributors.some((c) => c.actorId === contributor.id)).toBe(true);
  });
});
