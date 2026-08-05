import type { TimelineEntry } from '../types.js';
import { newId, nowIso } from '../types.js';

export class ProjectTimeline {
  private readonly entries: TimelineEntry[] = [];

  add(input: Omit<TimelineEntry, 'id' | 'at'> & { at?: string; id?: string }): TimelineEntry {
    const entry: TimelineEntry = {
      id: input.id ?? newId('tl'),
      at: input.at ?? nowIso(),
      kind: input.kind,
      title: input.title,
      detail: input.detail,
    };
    this.entries.push(entry);
    if (this.entries.length > 500) this.entries.splice(0, this.entries.length - 500);
    return entry;
  }

  list(limit = 50): TimelineEntry[] {
    return [...this.entries].reverse().slice(0, limit);
  }

  markdown(limit = 30): string {
    const rows = this.list(limit);
    return [
      '# Project Timeline',
      '',
      ...rows.map((e) => `## ${e.at.slice(0, 10)}\n\n**${e.title}**\n\n${e.detail}\n`),
    ].join('\n');
  }
}

export function createProjectTimeline(): ProjectTimeline {
  return new ProjectTimeline();
}
