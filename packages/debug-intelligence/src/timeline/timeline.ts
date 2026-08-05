import type { TimelineEvent } from '../types.js';
import { newId, nowIso } from '../types.js';

export class IncidentTimeline {
  private readonly events: TimelineEvent[] = [];

  add(input: Omit<TimelineEvent, 'id' | 'at'> & { at?: string; id?: string }): TimelineEvent {
    const e: TimelineEvent = {
      id: input.id ?? newId('tl'),
      at: input.at ?? nowIso(),
      kind: input.kind,
      title: input.title,
      detail: input.detail,
    };
    this.events.push(e);
    if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
    return e;
  }

  list(limit = 50): TimelineEvent[] {
    return [...this.events].sort((a, b) => a.at.localeCompare(b.at)).slice(-limit);
  }

  markdown(limit = 40): string {
    const rows = this.list(limit);
    return [
      '# Incident Timeline',
      '',
      ...rows.map((e) => `## ${e.at.slice(0, 10)} — ${e.title}\n\n${e.detail}\n`),
    ].join('\n');
  }

  /** Convenience chain for demos / reports */
  recordChain(input: {
    feature?: string;
    bug?: string;
    commit?: string;
    incident?: string;
    fix?: string;
  }): void {
    if (input.feature) this.add({ kind: 'feature', title: 'Feature created', detail: input.feature });
    if (input.bug) this.add({ kind: 'bug', title: 'Bug appeared', detail: input.bug });
    if (input.commit) this.add({ kind: 'commit', title: 'Commit changed module', detail: input.commit });
    if (input.incident) this.add({ kind: 'incident', title: 'Incident reported', detail: input.incident });
    if (input.fix) this.add({ kind: 'fix', title: 'Fix deployed', detail: input.fix });
  }
}

export function createIncidentTimeline(): IncidentTimeline {
  return new IncidentTimeline();
}
