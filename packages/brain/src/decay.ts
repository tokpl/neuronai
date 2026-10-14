import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { MemoryRecord } from '@neuronai/types';

import type { ProjectBrain } from './project-brain.js';

const PATH_RE = /(?:^|[\s`"'(])([a-zA-Z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|md))(?:$|[\s`"'`),:])/g;

/** Extract likely file paths from memory text. */
export function extractReferencedPaths(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(PATH_RE)) {
    const p = m[1];
    if (p && !p.startsWith('http')) found.add(p.replace(/^\.\//, ''));
  }
  return [...found];
}

export interface DecayFinding {
  id: string;
  title: string;
  missingPaths: string[];
}

/**
 * Flag memories/decisions that reference files no longer on disk.
 * Does not delete — returns findings for doctor / CLI.
 */
export function findStaleMemories(brain: ProjectBrain): DecayFinding[] {
  const root = brain.paths.projectRoot;
  const records: MemoryRecord[] = [
    ...brain.knowledge.memory,
    ...brain.knowledge.decisions,
  ];
  const out: DecayFinding[] = [];

  for (const rec of records) {
    const paths = extractReferencedPaths(`${rec.title}\n${rec.content}`);
    const missing = paths.filter((p) => !existsSync(join(root, p)));
    if (missing.length > 0 && paths.length > 0 && missing.length === paths.length) {
      out.push({ id: rec.id, title: rec.title, missingPaths: missing });
    }
  }
  return out;
}
