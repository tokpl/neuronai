import type { MemoryRecord } from '@neuron-ai-memory/types';

import { newRuleId, nowIso, type MistakeRecord, type ProjectConstitutionDocument } from '../rules/types.js';

/**
 * Capture developer corrections and mistake memories into the constitution.
 */
export class MistakeMemorySystem {
  fromMemories(doc: ProjectConstitutionDocument, memories: MemoryRecord[]): ProjectConstitutionDocument {
    const mistakes = memories
      .filter((m) => m.status === 'active' && m.type === 'mistake')
      .map((m) => this.toMistake(m));
    return {
      ...doc,
      updatedAt: nowIso(),
      mistakes: mergeMistakes(doc.mistakes, mistakes),
    };
  }

  recordCorrection(
    doc: ProjectConstitutionDocument,
    input: { title: string; detail: string; relatedModule?: string },
  ): ProjectConstitutionDocument {
    const mistake: MistakeRecord = {
      id: newRuleId(),
      title: input.title,
      detail: input.detail,
      relatedModule: input.relatedModule,
      createdAt: nowIso(),
    };
    return {
      ...doc,
      updatedAt: nowIso(),
      mistakes: mergeMistakes(doc.mistakes, [mistake]),
    };
  }

  private toMistake(m: MemoryRecord): MistakeRecord {
    return {
      id: newRuleId(),
      title: m.title,
      detail: m.content,
      relatedModule: guessModule(m.content),
      memoryId: m.id,
      createdAt: m.createdAt,
    };
  }
}

function guessModule(text: string): string | undefined {
  const m = text.match(/\b([A-Za-z][\w/-]*(?:Service|Controller|Module|api\/[\w/-]+))\b/);
  return m?.[1];
}

function mergeMistakes(existing: MistakeRecord[], incoming: MistakeRecord[]): MistakeRecord[] {
  const byTitle = new Map(existing.map((m) => [m.title.toLowerCase(), m]));
  for (const m of incoming) {
    byTitle.set(m.title.toLowerCase(), m);
  }
  return [...byTitle.values()].slice(0, 100);
}

export function createMistakeMemorySystem(): MistakeMemorySystem {
  return new MistakeMemorySystem();
}
