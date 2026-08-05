import type { ScopedMemoryRecord, TeamDocument } from '@neuron-ai-memory/team-memory';

import type { KnowledgeConflict } from '../types.js';
import { newId } from '../types.js';
import { memberDisplay } from '../shared-memory/mapper.js';

/**
 * Resolves conflicting team knowledge (e.g. REST vs GraphQL).
 * Advisory only — shows arguments, history, current standard.
 */
export class TeamKnowledgeConflictResolver {
  detect(doc: TeamDocument, topic: string): KnowledgeConflict | null {
    const q = topic.toLowerCase();
    const related = doc.memories.filter(
      (m) =>
        (m.status === 'active' ||
          m.status === 'approved' ||
          m.status === 'pending_review' ||
          m.status === 'proposed') &&
        (`${m.title} ${m.content}`.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))),
    );

    if (related.length < 2) return null;

    const [a, b] = related;
    if (!a || !b) return null;

    const approved = related.find((m) => m.status === 'active' || m.status === 'approved');
    const history = related
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
      .map(
        (m) =>
          `${m.createdAt.slice(0, 10)} · ${m.title} (${m.status}) by ${memberDisplay(doc.actors, m.createdBy)}`,
      );

    const argumentsList = [
      `A: ${a.title} — ${a.content.slice(0, 200)}`,
      `B: ${b.title} — ${b.content.slice(0, 200)}`,
      ...related.slice(2, 5).map((m) => `Also: ${m.title}`),
    ];

    return {
      id: newId('conflict'),
      topic,
      optionA: {
        title: a.title,
        content: a.content,
        author: memberDisplay(doc.actors, a.createdBy),
      },
      optionB: {
        title: b.title,
        content: b.content,
        author: memberDisplay(doc.actors, b.createdBy),
      },
      arguments: argumentsList,
      history,
      currentStandard: approved ? `${approved.title}: ${approved.content.slice(0, 240)}` : null,
      recommendation: approved
        ? `Current team standard is "${approved.title}". Treat alternatives as proposals until approved.`
        : `No approved standard yet for "${topic}". Keep both as REVIEW until a reviewer approves one.`,
    };
  }

  compare(
    doc: TeamDocument,
    optionAId: string,
    optionBId: string,
  ): KnowledgeConflict | null {
    const a = doc.memories.find((m) => m.id === optionAId);
    const b = doc.memories.find((m) => m.id === optionBId);
    if (!a || !b) return null;
    return this.detectFromPair(doc, a, b);
  }

  private detectFromPair(
    doc: TeamDocument,
    a: ScopedMemoryRecord,
    b: ScopedMemoryRecord,
  ): KnowledgeConflict {
    const approved =
      a.status === 'active' || a.status === 'approved'
        ? a
        : b.status === 'active' || b.status === 'approved'
          ? b
          : null;
    return {
      id: newId('conflict'),
      topic: `${a.title} vs ${b.title}`,
      optionA: {
        title: a.title,
        content: a.content,
        author: memberDisplay(doc.actors, a.createdBy),
      },
      optionB: {
        title: b.title,
        content: b.content,
        author: memberDisplay(doc.actors, b.createdBy),
      },
      arguments: [
        `A (${a.status}): ${a.content.slice(0, 200)}`,
        `B (${b.status}): ${b.content.slice(0, 200)}`,
      ],
      history: [
        `${a.createdAt} · ${a.title}`,
        `${b.createdAt} · ${b.title}`,
      ],
      currentStandard: approved ? approved.title : null,
      recommendation: approved
        ? `Prefer approved standard: ${approved.title}`
        : 'Neither option is APPROVED — escalate to team review.',
    };
  }
}

export function createTeamKnowledgeConflictResolver(): TeamKnowledgeConflictResolver {
  return new TeamKnowledgeConflictResolver();
}
