import { createMemoryAuditLog } from '../audit/audit-log.js';
import { createContributionTracker } from '../contribution/tracker.js';
import { createTeamKnowledgeGraph } from '../graph/team-graph.js';
import { createOnboardingEngine } from '../onboarding/engine.js';
import { createPermissionGate } from '../permissions/gate.js';
import { createTeamRetrievalScorer } from '../retrieval/team-scorer.js';
import {
  createTeamMemoryStore,
  emptyTeamDocument,
  resolveLocalActor,
  type TeamMemoryStore,
} from '../store/file-store.js';
import type { LocalActor, MemoryScope, TeamDocument } from '../types.js';
import { createDecisionReviewWorkflow } from '../workflow/decision-review.js';

export interface TeamMemoryServiceOptions {
  neuronDir: string;
  projectId: string;
  teamName?: string;
}

/**
 * Local-first facade for team memory architecture.
 * Persistence: `.neuron/team/team-memory.json` — no cloud.
 */
export class TeamMemoryService {
  private readonly store: TeamMemoryStore;
  private readonly workflow = createDecisionReviewWorkflow();
  private readonly onboarding = createOnboardingEngine();
  private readonly scorer = createTeamRetrievalScorer();
  private readonly contrib = createContributionTracker();
  private readonly audit = createMemoryAuditLog();
  private readonly graph = createTeamKnowledgeGraph();
  private readonly gate = createPermissionGate();
  private doc: TeamDocument | null = null;

  constructor(private readonly options: TeamMemoryServiceOptions) {
    this.store = createTeamMemoryStore(options.neuronDir);
  }

  async load(): Promise<TeamDocument> {
    this.doc = await this.store.load({
      projectId: this.options.projectId,
      teamName: this.options.teamName,
    });
    return this.doc;
  }

  async save(doc: TeamDocument): Promise<void> {
    this.doc = doc;
    await this.store.save(doc);
  }

  getDocument(): TeamDocument {
    if (!this.doc) {
      this.doc = emptyTeamDocument({
        projectId: this.options.projectId,
        teamName: this.options.teamName,
      });
    }
    return this.doc;
  }

  actor(hint?: Parameters<typeof resolveLocalActor>[1]): LocalActor {
    return resolveLocalActor(this.getDocument(), hint);
  }

  async upsertActor(actor: LocalActor): Promise<TeamDocument> {
    let doc = this.getDocument();
    const others = doc.actors.filter((a) => a.id !== actor.id);
    doc = this.graph.ensureBase({ ...doc, actors: [...others, actor] });
    await this.save(doc);
    return doc;
  }

  async proposeDecision(
    actorHint: Parameters<typeof resolveLocalActor>[1],
    input: {
      title: string;
      content: string;
      type?: string;
      scope?: MemoryScope;
      tags?: string[];
      memoryId?: string | null;
    },
  ) {
    const doc = await this.load();
    const actor = resolveLocalActor(doc, actorHint);
    const result = this.workflow.propose(doc, actor, input);
    await this.save(result.doc);
    return result;
  }

  async approveDecision(actorHint: Parameters<typeof resolveLocalActor>[1], memoryId: string) {
    const doc = await this.load();
    const actor = resolveLocalActor(doc, actorHint);
    const result = this.workflow.approve(doc, actor, memoryId);
    await this.save(result.doc);
    return result;
  }

  async rejectDecision(
    actorHint: Parameters<typeof resolveLocalActor>[1],
    memoryId: string,
    reason?: string,
  ) {
    const doc = await this.load();
    const actor = resolveLocalActor(doc, actorHint);
    const next = this.workflow.reject(doc, actor, memoryId, reason);
    await this.save(next);
    return next;
  }

  async onboardingPack(actorHint?: Parameters<typeof resolveLocalActor>[1]) {
    const doc = await this.load();
    const actor = resolveLocalActor(doc, actorHint);
    const { pack, doc: next } = this.onboarding.generate(doc, actor);
    await this.save(next);
    return pack;
  }

  async teamContext(query: string, actorHint?: Parameters<typeof resolveLocalActor>[1]) {
    const doc = await this.load();
    const actor = resolveLocalActor(doc, actorHint);
    const hits = this.scorer.score(doc, actor, query).slice(0, 20);
    return {
      actor,
      hits,
      markdown: [
        `# Team context — ${query}`,
        '',
        ...hits.map(
          (h) =>
            `- [${h.memory.scope}] (${h.finalScore.toFixed(2)}) ${h.memory.title}: ${h.memory.content}`,
        ),
      ].join('\n'),
    };
  }

  async decisionHistory(limit = 30) {
    const doc = await this.load();
    return doc.memories
      .filter((m) => m.type === 'architecture_decision' || /decision/i.test(m.title))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  async contributors(limit = 20) {
    const doc = await this.load();
    const ranked = this.contrib.topContributors(doc, limit);
    return ranked.map((r) => {
      const actor = doc.actors.find((a) => a.id === r.actorId);
      return {
        actorId: r.actorId,
        displayName: actor?.displayName ?? r.actorId,
        role: actor?.role ?? 'contributor',
        score: r.count,
      };
    });
  }

  permissionsFor(scope: MemoryScope) {
    return this.gate.describe(scope);
  }

  async recentAudit(limit = 40) {
    const doc = await this.load();
    return this.audit.recent(doc, limit);
  }
}

export function createTeamMemoryService(options: TeamMemoryServiceOptions): TeamMemoryService {
  return new TeamMemoryService(options);
}
