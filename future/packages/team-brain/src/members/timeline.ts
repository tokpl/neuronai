import type { TeamDocument } from '@neuron-ai-memory/team-memory';

import type { TimelineEvent } from '../types.js';

/**
 * TeamEngineeringTimeline — major decisions, architecture changes, incidents, migrations.
 */
export class TeamEngineeringTimeline {
  build(doc: TeamDocument, limit = 40): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    for (const m of doc.memories) {
      const kind = classify(m.type, m.title, m.content);
      events.push({
        id: m.id,
        at: m.updatedAt || m.createdAt,
        kind,
        title: m.title,
        actorId: m.approvedBy ?? m.createdBy,
        status: m.status,
      });
    }

    for (const a of doc.audit.slice(-50)) {
      if (a.action === 'approve' || a.action === 'archive') {
        events.push({
          id: a.id,
          at: a.at,
          kind: 'approval',
          title: `${a.action}: ${a.memoryId}`,
          actorId: a.actorId,
          status: a.action,
        });
      }
    }

    return events.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit);
  }

  markdown(doc: TeamDocument, limit = 40): string {
    const events = this.build(doc, limit);
    return [
      '# Team engineering timeline',
      '',
      ...events.map(
        (e) =>
          `- ${e.at.slice(0, 10)} · **${e.kind}** · ${e.title}` +
          (e.status ? ` (${e.status})` : ''),
      ),
    ].join('\n');
  }
}

function classify(
  type: string,
  title: string,
  content: string,
): TimelineEvent['kind'] {
  const blob = `${type} ${title} ${content}`.toLowerCase();
  if (/incident|mistake|outage|bug/.test(blob)) return 'incident';
  if (/migrat|upgrade|schema/.test(blob)) return 'migration';
  if (/rule|convention|must|prefer/.test(blob)) return 'rule';
  if (/architect|module|service|stack/.test(blob)) return 'architecture';
  return 'decision';
}

export function createTeamEngineeringTimeline(): TeamEngineeringTimeline {
  return new TeamEngineeringTimeline();
}
