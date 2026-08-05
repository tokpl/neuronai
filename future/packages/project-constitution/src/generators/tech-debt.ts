import type { MemoryRecord } from '@neuron-ai-memory/types';

import {
  newRuleId,
  nowIso,
  type ProjectConstitutionDocument,
  type TechDebtItem,
} from '../rules/types.js';

/**
 * Surface TODOs, deprecated markers, and temporary workarounds as tech-debt memory.
 */
export class TechnicalDebtMemory {
  scanTextSnippets(
    doc: ProjectConstitutionDocument,
    snippets: Array<{ path?: string; text: string }>,
  ): ProjectConstitutionDocument {
    const found: TechDebtItem[] = [];
    for (const s of snippets) {
      if (/\bTODO\b|\bFIXME\b/i.test(s.text)) {
        found.push({
          id: newRuleId(),
          title: `TODO in ${s.path ?? 'code'}`,
          detail: clip(s.text),
          kind: 'todo',
          relatedPath: s.path,
          reminder: 'Resolve or convert to a tracked issue',
          createdAt: nowIso(),
        });
      }
      if (/\b@deprecated\b|deprecated/i.test(s.text)) {
        found.push({
          id: newRuleId(),
          title: `Deprecated usage ${s.path ?? ''}`.trim(),
          detail: clip(s.text),
          kind: 'deprecated',
          relatedPath: s.path,
          reminder: 'Plan removal',
          createdAt: nowIso(),
        });
      }
      if (/temporary workaround|hack\b|for now\b/i.test(s.text)) {
        found.push({
          id: newRuleId(),
          title: `Temporary workaround ${s.path ?? ''}`.trim(),
          detail: clip(s.text),
          kind: 'workaround',
          relatedPath: s.path,
          reminder: 'Review after related migration',
          createdAt: nowIso(),
        });
      }
    }
    return {
      ...doc,
      updatedAt: nowIso(),
      techDebt: mergeDebt(doc.techDebt, found).slice(0, 80),
    };
  }

  fromMemories(doc: ProjectConstitutionDocument, memories: MemoryRecord[]): ProjectConstitutionDocument {
    const debt = memories
      .filter((m) => m.status === 'active')
      .filter((m) => /todo|workaround|temporary|deprecated|tech.?debt/i.test(`${m.title} ${m.content}`))
      .map(
        (m): TechDebtItem => ({
          id: newRuleId(),
          title: m.title,
          detail: m.content,
          kind: /deprecated/i.test(m.title) ? 'deprecated' : /todo/i.test(m.title) ? 'todo' : 'temporary',
          reminder: 'Review during next periodic evolution pass',
          createdAt: m.createdAt,
        }),
      );
    return {
      ...doc,
      updatedAt: nowIso(),
      techDebt: mergeDebt(doc.techDebt, debt).slice(0, 80),
    };
  }
}

function clip(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function mergeDebt(a: TechDebtItem[], b: TechDebtItem[]): TechDebtItem[] {
  const map = new Map(a.map((x) => [x.title.toLowerCase(), x]));
  for (const x of b) map.set(x.title.toLowerCase(), x);
  return [...map.values()];
}

export function createTechnicalDebtMemory(): TechnicalDebtMemory {
  return new TechnicalDebtMemory();
}
