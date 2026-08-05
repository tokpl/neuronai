import type {
  ArchitectureTransition,
  EngineeringTimeline,
  GitChangeMemory,
  TimelineEvent,
} from './types.js';
import { newId } from './types.js';

/**
 * Engineering timeline: commits + decisions + incidents + architecture.
 */
export class EngineeringTimelineBuilder {
  build(input: {
    changes?: GitChangeMemory[];
    transitions?: ArchitectureTransition[];
    decisions?: Array<{ title: string; at?: string; id?: string }>;
    incidents?: Array<{ title: string; at?: string; id?: string }>;
  }): EngineeringTimeline {
    const events: TimelineEvent[] = [];

    for (const c of input.changes ?? []) {
      events.push({
        id: newId('tl'),
        at: c.date,
        kind: 'commit',
        title: `${c.changeType}: ${c.messageSummary}`,
        refs: [c.commit, ...c.modulesAffected.slice(0, 3)],
      });
    }
    for (const t of input.transitions ?? []) {
      events.push({
        id: newId('tl'),
        at: t.date,
        kind: 'architecture',
        title: t.memoryTitle,
        refs: [t.before, t.after, t.commit ?? ''].filter(Boolean),
      });
    }
    for (const d of input.decisions ?? []) {
      events.push({
        id: newId('tl'),
        at: d.at ?? new Date(0).toISOString(),
        kind: 'decision',
        title: d.title,
        refs: d.id ? [d.id] : [],
      });
    }
    for (const i of input.incidents ?? []) {
      events.push({
        id: newId('tl'),
        at: i.at ?? new Date(0).toISOString(),
        kind: 'incident',
        title: i.title,
        refs: i.id ? [i.id] : [],
      });
    }

    events.sort((a, b) => b.at.localeCompare(a.at));
    return {
      events: events.slice(0, 100),
      note: 'Technical project timeline — not people productivity tracking.',
    };
  }
}

export function createEngineeringTimelineBuilder(): EngineeringTimelineBuilder {
  return new EngineeringTimelineBuilder();
}
