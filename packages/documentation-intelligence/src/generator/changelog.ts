import type { ChangelogInput, DocumentationArtifact } from '../types.js';
import { newId, nowIso } from '../types.js';
import { changelogTemplate } from '../templates/changelog.js';

/**
 * Smart changelog from features/decisions/incidents — not commit subjects alone.
 */
export class SmartChangelogGenerator {
  generate(input: ChangelogInput): DocumentationArtifact {
    const added = unique([
      ...(input.features ?? []),
      ...classify(input.commits ?? [], 'add'),
    ]);
    const changed = unique([
      ...(input.decisions ?? []).map((d) => `Decision update: ${d}`),
      ...classify(input.commits ?? [], 'change'),
    ]);
    const fixed = unique([
      ...(input.incidents ?? []).map((i) => `Incident resolved: ${i}`),
      ...classify(input.commits ?? [], 'fix'),
    ]);

    return {
      id: newId('doc'),
      type: 'CHANGELOG',
      source: 'generated',
      path: '.neuron/docs/CHANGELOG.md',
      title: 'Changelog',
      content: changelogTemplate({ added, changed, fixed }),
      generatedFrom: ['commits', 'features', 'decisions', 'incidents'],
      lastUpdated: nowIso(),
      confidence: added.length || changed.length || fixed.length ? 0.7 : 0.35,
      status: 'CURRENT',
    };
  }
}

function classify(commits: string[], kind: 'add' | 'change' | 'fix'): string[] {
  return commits
    .filter((c) => {
      const t = c.toLowerCase();
      if (kind === 'add') return /^(feat|add)\b|added\b/.test(t);
      if (kind === 'fix') return /^(fix)\b|fixed\b|bug/.test(t);
      return /^(refactor|chore|change|docs)\b|changed\b|update/.test(t);
    })
    .map((c) => c.replace(/^(feat|fix|chore|refactor|docs)(\(.+\))?:\s*/i, '').trim());
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((i) => i.trim()).filter(Boolean))];
}

export function createSmartChangelogGenerator(): SmartChangelogGenerator {
  return new SmartChangelogGenerator();
}
