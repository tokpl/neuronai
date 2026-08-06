import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { pathExists } from './neuron-fs.js';

export type GitIgnorePreset =
  | 'ephemeral'
  | 'ephemeral+config'
  | 'all-local'
  | 'skip';

const MARKER_BEGIN = '# >>> neuronai';
const MARKER_END = '# <<< neuronai';

const EPHEMERAL_ENTRIES = [
  '.neuron/cache/',
  '.neuron/runtime/',
  '.neuron/indexes/',
  '.neuron/logs/',
  '.neuron/export/',
  '.neuron/data/',
  '.neuron/backup/',
  '.neuron/integrations/',
] as const;

function blockFor(preset: Exclude<GitIgnorePreset, 'skip'>): string {
  const lines: string[] = [MARKER_BEGIN, '# Managed by `neuron init` — edit carefully'];

  if (preset === 'all-local') {
    lines.push('.neuron/', 'neuron.config.json');
  } else {
    lines.push('# Keep .neuron/*.json shareable for Team Brain via Git');
    lines.push(...EPHEMERAL_ENTRIES);
    if (preset === 'ephemeral+config') {
      lines.push('neuron.config.json');
    }
  }

  lines.push(MARKER_END);
  return `${lines.join('\n')}\n`;
}

/**
 * Upsert a managed Neuron block in the project `.gitignore`.
 * Returns whether the file was written/updated.
 */
export async function applyNeuronGitignore(
  cwd: string,
  preset: GitIgnorePreset,
): Promise<{ applied: boolean; path: string; preset: GitIgnorePreset }> {
  const gitignorePath = join(cwd, '.gitignore');
  if (preset === 'skip') {
    return { applied: false, path: gitignorePath, preset };
  }

  const block = blockFor(preset);
  let existing = '';
  if (await pathExists(gitignorePath)) {
    existing = await readFile(gitignorePath, 'utf8');
  }

  const begin = existing.indexOf(MARKER_BEGIN);
  const end = existing.indexOf(MARKER_END);
  let next: string;
  if (begin !== -1 && end !== -1 && end > begin) {
    const afterEnd = end + MARKER_END.length;
    const before = existing.slice(0, begin).replace(/\n*$/, '\n\n');
    const after = existing.slice(afterEnd).replace(/^\n*/, '\n');
    next = `${before}${block}${after}`.replace(/\n{3,}/g, '\n\n');
  } else if (existing.trim().length === 0) {
    next = block;
  } else {
    next = `${existing.replace(/\n*$/, '\n')}\n${block}`;
  }

  if (next === existing) {
    return { applied: false, path: gitignorePath, preset };
  }

  await writeFile(gitignorePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return { applied: true, path: gitignorePath, preset };
}
