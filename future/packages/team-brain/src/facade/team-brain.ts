import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createTeamMemoryService,
  type LocalActor,
  type TeamDocument,
  type TeamMemoryService,
} from '@neuron-ai-memory/team-memory';

import { createKnowledgeAuditLog } from '../audit/knowledge-audit-log.js';
import { createNewDeveloperMode } from '../members/new-developer-mode.js';
import { createTeamEngineeringTimeline } from '../members/timeline.js';
import { createMemoryOwnershipService } from '../ownership/memory-ownership.js';
import { createKnowledgePermissions } from '../permissions/knowledge-permissions.js';
import { createMemoryApprovalFlow } from '../shared-memory/approval-flow.js';
import { createTeamKnowledgeConflictResolver } from '../shared-memory/conflict-resolver.js';
import { toSharedMemory } from '../shared-memory/mapper.js';
import { createKnowledgeSyncProvider } from '../sync/knowledge-sync.js';
import type {
  KnowledgePermissionLevel,
  SharedMemory,
  SyncMode,
  TeamBrainDocument,
  TeamBrainModel,
  TeamMember,
} from '../types.js';
import { nowIso } from '../types.js';

export interface TeamBrainOptions {
  neuronDir: string;
  projectId: string;
  teamName?: string;
  syncMode?: SyncMode;
  syncEndpoint?: string;
}

/**
 * TeamBrain facade — one technical brain for the team.
 * Local-first; no social network, chat, or public sharing.
 */
export class TeamBrain {
  private readonly teamMemory: TeamMemoryService;
  private readonly permissions = createKnowledgePermissions();
  private readonly approval = createMemoryApprovalFlow();
  private readonly conflicts = createTeamKnowledgeConflictResolver();
  private readonly timeline = createTeamEngineeringTimeline();
  private readonly newDevMode = createNewDeveloperMode();
  private readonly ownership = createMemoryOwnershipService();
  private readonly audit = createKnowledgeAuditLog();
  private syncMode: SyncMode;
  private syncEndpoint?: string;

  constructor(private readonly options: TeamBrainOptions) {
    this.teamMemory = createTeamMemoryService({
      neuronDir: options.neuronDir,
      projectId: options.projectId,
      teamName: options.teamName,
    });
    this.syncMode = options.syncMode ?? 'local_only';
    this.syncEndpoint = options.syncEndpoint;
  }

  async load(): Promise<TeamDocument> {
    const doc = await this.teamMemory.load();
    try {
      const meta = JSON.parse(
        await readFile(join(this.options.neuronDir, 'team', 'team-brain.json'), 'utf8'),
      ) as Partial<TeamBrainDocument>;
      if (meta.syncMode) this.syncMode = meta.syncMode;
      if (meta.audit) this.audit.load(meta.audit);
    } catch {
      /* first run */
    }
    return doc;
  }

  async saveMeta(): Promise<string> {
    const dir = join(this.options.neuronDir, 'team');
    await mkdir(dir, { recursive: true });
    const path = join(dir, 'team-brain.json');
    const model = this.toModel(this.teamMemory.getDocument());
    const doc: TeamBrainDocument = {
      version: 1,
      brain: model,
      audit: this.audit.list(200),
      syncMode: this.syncMode,
      updatedAt: nowIso(),
    };
    await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return path;
  }

  toModel(doc: TeamDocument): TeamBrainModel {
    const members: TeamMember[] = doc.actors.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      permission: this.permissions.levelFromRole(a.role),
      joinedAt: doc.updatedAt,
    }));
    const sharedKnowledge = doc.memories
      .filter((m) => m.scope !== 'PERSONAL')
      .map((m) => toSharedMemory(m));

    return {
      id: doc.teamId,
      name: doc.teamName,
      projects: [doc.projectId],
      members,
      sharedKnowledge,
      permissions: ['VIEW', 'COMMENT', 'SUGGEST', 'APPROVE', 'ADMIN'],
      createdAt: doc.memories[0]?.createdAt ?? doc.updatedAt,
    };
  }

  async upsertMember(actor: LocalActor): Promise<void> {
    await this.teamMemory.upsertActor(actor);
    await this.saveMeta();
  }

  async proposeSharedMemory(
    actorHint: { actorId?: string; role?: LocalActor['role']; displayName?: string },
    input: { title: string; content: string; type?: string; tags?: string[] },
  ): Promise<SharedMemory> {
    await this.load();
    const actor = this.teamMemory.actor(actorHint);
    const result = this.approval.propose(this.teamMemory.getDocument(), actor, input);
    await this.teamMemory.save(result.doc);
    this.audit.append({
      action: 'Memory created',
      memoryId: result.memory.id,
      actorId: actor.id,
      detail: result.memory.title,
    });
    await this.saveMeta();
    return result.memory;
  }

  async approveSharedMemory(
    actorHint: { actorId?: string; role?: LocalActor['role'] },
    memoryId: string,
  ): Promise<SharedMemory> {
    await this.load();
    const actor = this.teamMemory.actor(actorHint);
    const result = this.approval.approve(this.teamMemory.getDocument(), actor, memoryId);
    await this.teamMemory.save(result.doc);
    this.audit.append({
      action: 'Memory approved',
      memoryId,
      actorId: actor.id,
    });
    await this.saveMeta();
    return result.memory;
  }

  async teamContext(query: string, actorId?: string) {
    await this.load();
    const ctx = await this.teamMemory.teamContext(query, { actorId });
    const conflict = this.conflicts.detect(this.teamMemory.getDocument(), query);
    return {
      ...ctx,
      conflict,
      brain: this.toModel(this.teamMemory.getDocument()),
      note: 'Local-first team brain — no automatic sharing.',
    };
  }

  async teamDecisions(limit = 30) {
    await this.load();
    const decisions = await this.teamMemory.decisionHistory(limit);
    return decisions.map((d) => toSharedMemory(d));
  }

  async teamRules(limit = 40) {
    await this.load();
    const doc = this.teamMemory.getDocument();
    return doc.memories
      .filter(
        (m) =>
          (m.status === 'active' || m.status === 'approved') &&
          (m.type === 'pattern' ||
            m.type === 'business_rule' ||
            /rule|convention|prefer|must|security/i.test(`${m.title} ${m.content}`)),
      )
      .slice(0, limit)
      .map((m) => toSharedMemory(m));
  }

  async onboarding(actorId?: string) {
    await this.load();
    const { bundle, doc } = this.newDevMode.generate(this.teamMemory.getDocument(), actorId);
    await this.teamMemory.save(doc);
    await this.saveMeta();
    return bundle;
  }

  async engineeringTimeline(limit = 40) {
    await this.load();
    const doc = this.teamMemory.getDocument();
    return {
      events: this.timeline.build(doc, limit),
      markdown: this.timeline.markdown(doc, limit),
    };
  }

  detectConflict(topic: string) {
    const doc = this.teamMemory.getDocument();
    return this.conflicts.detect(doc, topic);
  }

  permissionModel() {
    return this.permissions.describe();
  }

  can(actorLevel: KnowledgePermissionLevel, required: KnowledgePermissionLevel): boolean {
    return this.permissions.can(actorLevel, required);
  }

  ownershipDescribe(creator: string, approvedBy?: string) {
    return this.ownership.describe(
      this.ownership.create({ creator, approvedBy: approvedBy ?? null, source: 'team-brain' }),
    );
  }

  async sync() {
    const sync = createKnowledgeSyncProvider(this.syncMode, this.syncEndpoint);
    await this.load();
    const model = this.toModel(this.teamMemory.getDocument());
    const brainDoc: TeamBrainDocument = {
      version: 1,
      brain: model,
      audit: this.audit.list(),
      syncMode: this.syncMode,
      updatedAt: nowIso(),
    };
    return sync.push(brainDoc);
  }

  recentAudit(limit = 40) {
    return this.audit.list(limit);
  }

  getTeamMemory(): TeamMemoryService {
    return this.teamMemory;
  }
}

export function createTeamBrain(options: TeamBrainOptions): TeamBrain {
  return new TeamBrain(options);
}
