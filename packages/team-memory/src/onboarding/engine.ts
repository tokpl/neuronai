import type { LocalActor, ScopedMemoryRecord, TeamDocument } from '../types.js';
import { createPermissionGate } from '../permissions/gate.js';
import { createTeamKnowledgeGraph } from '../graph/team-graph.js';
import { createMemoryAuditLog } from '../audit/audit-log.js';

export interface OnboardingPack {
  markdown: string;
  architectureOverview: string[];
  importantDecisions: string[];
  commonMistakes: string[];
  codingRules: string[];
  memoryIds: string[];
}

/**
 * Shortens onboarding: "How does this project work?"
 */
export class OnboardingEngine {
  private readonly gate = createPermissionGate();
  private readonly graph = createTeamKnowledgeGraph();
  private readonly audit = createMemoryAuditLog();

  generate(
    doc: TeamDocument,
    actor: LocalActor,
    options: { includePersonal?: boolean } = {},
  ): { pack: OnboardingPack; doc: TeamDocument } {
    const visible = doc.memories.filter((m) => {
      if (m.status !== 'active' && m.status !== 'approved') return false;
      if (m.scope === 'PERSONAL' && !options.includePersonal) return false;
      if (m.scope === 'PERSONAL' && m.ownerId !== actor.id) return false;
      return this.gate.can({
        scope: m.scope,
        action: 'read',
        role: actor.role,
        actorId: actor.id,
        ownerId: m.ownerId,
      });
    });

    const architectureOverview = pick(visible, (m) =>
      /architect|module|stack|structure|overview/i.test(`${m.title} ${m.content}`) ||
      m.type === 'knowledge',
    );
    const importantDecisions = pick(
      visible.filter((m) => m.type === 'architecture_decision' || /decision/i.test(m.title)),
      () => true,
      12,
    );
    const commonMistakes = pick(visible, (m) =>
      m.type === 'mistake' || /do not|never|warning|mistake|pitfall/i.test(`${m.title} ${m.content}`),
    );
    const codingRules = pick(visible, (m) =>
      m.type === 'pattern' ||
      m.type === 'business_rule' ||
      /prefer|convention|rule|must|should/i.test(`${m.title} ${m.content}`),
    );

    const memoryIds = [
      ...architectureOverview,
      ...importantDecisions,
      ...commonMistakes,
      ...codingRules,
    ].map((m) => m.id);

    let next = this.graph.ensureBase(doc);
    for (const id of [...new Set(memoryIds)].slice(0, 20)) {
      next = this.graph.recordUsedBy(next, id, actor);
      next = this.audit.append(next, {
        memoryId: id,
        actorId: actor.id,
        action: 'read',
        scope: visible.find((m) => m.id === id)?.scope ?? 'PROJECT',
        detail: 'onboarding',
      });
    }

    const pack: OnboardingPack = {
      architectureOverview: architectureOverview.map(fmt),
      importantDecisions: importantDecisions.map(fmt),
      commonMistakes: commonMistakes.map(fmt),
      codingRules: codingRules.map(fmt),
      memoryIds: [...new Set(memoryIds)],
      markdown: [
        `# Project onboarding — ${doc.teamName}`,
        '',
        `_Local team memory · actor: ${actor.displayName} (${actor.role})_`,
        '',
        '## Architecture overview',
        ...(architectureOverview.length ? architectureOverview.map((m) => `- ${fmt(m)}`) : ['- (none yet)']),
        '',
        '## Important decisions',
        ...(importantDecisions.length ? importantDecisions.map((m) => `- ${fmt(m)}`) : ['- (none yet)']),
        '',
        '## Common mistakes',
        ...(commonMistakes.length ? commonMistakes.map((m) => `- ${fmt(m)}`) : ['- (none yet)']),
        '',
        '## Coding rules',
        ...(codingRules.length ? codingRules.map((m) => `- ${fmt(m)}`) : ['- (none yet)']),
        '',
        '## Tip',
        '- Ask Cursor: “Prepare adding X using Neuron” after reading this pack.',
        '- Official decisions require review approval before they become PROJECT truth.',
      ].join('\n'),
    };

    return { pack, doc: next };
  }
}

function pick(
  items: ScopedMemoryRecord[],
  pred: (m: ScopedMemoryRecord) => boolean,
  limit = 8,
): ScopedMemoryRecord[] {
  return items.filter(pred).slice(0, limit);
}

function fmt(m: ScopedMemoryRecord): string {
  return `[${m.scope}] ${m.title}: ${m.content}`;
}

export function createOnboardingEngine(): OnboardingEngine {
  return new OnboardingEngine();
}
