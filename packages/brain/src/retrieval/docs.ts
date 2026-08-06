import type { MemoryRecord } from '@neuronai/types';

import type { KnowledgePlane, ProjectDna, ProjectMapEntry } from '../models.js';
import { conceptsFor } from './concepts.js';
import type { RetrievalDoc, RetrievalKind } from './rank.js';

/** Brain state needed to build a retrieval corpus. */
export interface BrainDocSource {
  knowledge: KnowledgePlane;
  dna?: ProjectDna;
}

const HALF_LIFE_DAYS = 90;

function freshnessFrom(iso?: string | null): number {
  if (!iso) return 0.5;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0.5;
  const days = Math.max(0, (Date.now() - then) / 86_400_000);
  return Math.min(1, Math.max(0, Math.pow(0.5, days / HALF_LIFE_DAYS)));
}

function kindForMemory(type: string): RetrievalKind {
  if (type === 'architecture_decision') return 'decision';
  if (type === 'mistake') return 'warning';
  if (type === 'pattern') return 'pattern';
  if (type === 'business_rule') return 'rule';
  return 'knowledge';
}

/** Convert engine memory records into retrieval documents. */
export function memoryDocs(memories: MemoryRecord[]): RetrievalDoc[] {
  return memories.map((memory) => ({
    id: memory.id,
    title: memory.title,
    content: memory.content,
    kind: kindForMemory(memory.type),
    type: memory.type,
    tags: memory.tags,
    importance: memory.importanceScore,
    freshness: memory.freshnessScore,
    confidence: memory.confidenceScore,
  }));
}

/**
 * Build the full retrieval corpus from the durable Project Brain.
 * Every plane that holds knowledge contributes; ids stay stable across calls.
 */
export function brainDocs(source: BrainDocSource): RetrievalDoc[] {
  const { knowledge, dna } = source;
  const docs: RetrievalDoc[] = [];

  docs.push(...memoryDocs(knowledge.memory));
  docs.push(...memoryDocs(knowledge.decisions));

  for (const rule of knowledge.rules) {
    docs.push({
      id: `rule:${rule.id}`,
      title: rule.title,
      content: rule.body,
      kind: 'rule',
      importance: rule.critical ? 0.9 : 0.6,
      freshness: freshnessFrom(knowledge.updatedAt),
      confidence: 0.8,
    });
  }

  for (const entry of knowledge.map?.entries ?? []) {
    docs.push(mapEntryDoc(entry, freshnessFrom(knowledge.map?.updatedAt)));
  }

  if (dna) {
    const stack = dna.stack.tags?.value ?? [];
    const identityBits = [
      dna.meta.summary,
      dna.stack.language?.value ? `Language: ${dna.stack.language.value}` : '',
      dna.stack.framework?.value ? `Framework: ${dna.stack.framework.value}` : '',
      dna.platforms.data?.value ? `Database: ${dna.platforms.data.value}` : '',
      dna.stack.packageManager?.value ? `Package manager: ${dna.stack.packageManager.value}` : '',
      stack.length ? `Stack: ${stack.join(', ')}` : '',
      dna.structure.modules?.value?.length
        ? `Modules: ${dna.structure.modules.value.slice(0, 12).join(', ')}`
        : '',
    ].filter(Boolean);

    if (identityBits.length) {
      docs.push({
        id: 'dna:summary',
        title: dna.identity.name?.value ?? 'Project identity',
        content: identityBits.join('\n'),
        kind: 'knowledge',
        tags: [
          ...stack,
          'project',
          'architecture',
          ...(dna.platforms.data?.value ? ['database'] : []),
        ],
        importance: 0.65,
        freshness: freshnessFrom(dna.meta.generatedAt),
        confidence: dna.meta.overallConfidence || 0.6,
      });
    }
  }

  return docs;
}

/** A module, file, symbol or route becomes a searchable "here is where it lives". */
export function mapEntryDoc(entry: ProjectMapEntry, freshness = 0.8): RetrievalDoc {
  const concepts = entry.concepts?.length
    ? entry.concepts
    : conceptsFor(`${entry.name} ${entry.path} ${entry.purpose ?? ''}`);

  // The path is indexed as text too, so "where is stripe.ts" matches on the path.
  const searchablePath = entry.path.replace(/[/\\.]/g, ' ');
  const label =
    entry.kind === 'module'
      ? `${entry.name} module`
      : entry.kind === 'route'
        ? `Route ${entry.name}`
        : entry.name;

  return {
    id: `map:${entry.kind}:${entry.path}:${entry.name}`,
    title: `${label} — ${entry.path}`,
    content: [entry.purpose, `Location: ${entry.path}`, searchablePath]
      .filter(Boolean)
      .join('\n'),
    kind: 'location',
    tags: [...concepts, ...(entry.module ? [entry.module] : []), entry.kind],
    importance: entry.kind === 'module' ? 0.75 : 0.6,
    freshness,
    confidence: 0.9,
    location: entry,
  };
}
