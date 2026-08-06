import type { MemoryRecord } from '@neuronai/types';

/**
 * Scan-derived knowledge must stay grounded in paths that still exist.
 * User-authored memories are never touched here.
 */

const PATH_MENTION =
  /(?:^|[\s("`'])((?:src|apps|packages|lib|tests?|docs)\/[A-Za-z0-9_./-]+)/g;

export function isScanDerived(memory: MemoryRecord): boolean {
  return memory.tags.includes('scan') || memory.source === 'git';
}

export function isUserAuthored(memory: MemoryRecord): boolean {
  return memory.source === 'user' || memory.source === 'manual' || memory.tags.includes('manual');
}

/** Normalize to forward-slash repo-relative paths. */
export function normalizeEvidencePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/[.,;:)+\]}'"`]+$/g, '')
    .replace(/\/+$/, '');
}

export function buildLivePathIndex(paths: Iterable<string>): {
  files: Set<string>;
  prefixes: string[];
} {
  const files = new Set<string>();
  const prefixes: string[] = [];
  for (const raw of paths) {
    const p = normalizeEvidencePath(raw);
    if (!p) continue;
    files.add(p);
    if (p.endsWith('/')) prefixes.push(p);
    else {
      const dir = p.includes('/') ? `${p.slice(0, p.lastIndexOf('/') + 1)}` : '';
      if (dir) prefixes.push(dir);
    }
  }
  return { files, prefixes: [...new Set(prefixes)] };
}

export function pathExistsInIndex(
  path: string,
  index: { files: Set<string>; prefixes: string[] },
): boolean {
  const p = normalizeEvidencePath(path);
  if (!p) return false;
  if (index.files.has(p)) return true;
  if (index.files.has(`${p}/`)) return true;
  // Directory evidence: src/billing/ matches any file under it
  if (p.endsWith('/') || !p.includes('.')) {
    const prefix = p.endsWith('/') ? p : `${p}/`;
    for (const file of index.files) {
      if (file.startsWith(prefix)) return true;
    }
  }
  // File evidence still valid if parent module dir is live? No — require exact/prefix.
  for (const prefix of index.prefixes) {
    if (p.startsWith(prefix) && index.files.has(p)) return true;
  }
  return index.files.has(p);
}

export function evidencePathsFor(memory: MemoryRecord): string[] {
  if (memory.paths?.length) {
    return memory.paths.map(normalizeEvidencePath).filter(Boolean);
  }
  // Legacy scan memories: recover path mentions from prose.
  const text = `${memory.title}\n${memory.content}`;
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(PATH_MENTION)) {
    const p = normalizeEvidencePath(match[1] ?? '');
    if (!p || seen.has(p)) continue;
    seen.add(p);
    found.push(p);
  }
  return found;
}

/**
 * True when every evidence path is gone from the live project.
 * Memories with no recoverable paths are left alone (stack/docs/git).
 * Legacy prose recovery only invalidates when multiple concrete paths are gone,
 * to avoid false positives from a single guessed `src/<module>/` hint.
 */
export function isScanMemoryStale(
  memory: MemoryRecord,
  live: { files: Set<string>; prefixes: string[] },
): boolean {
  if (isUserAuthored(memory)) return false;
  if (!isScanDerived(memory)) return false;

  if (memory.paths?.length) {
    return memory.paths
      .map(normalizeEvidencePath)
      .filter(Boolean)
      .every((p) => !pathExistsInIndex(p, live));
  }

  const evidence = evidencePathsFor(memory);
  if (evidence.length < 2) return false;
  return evidence.every((p) => !pathExistsInIndex(p, live));
}

export function listStaleScanMemories(
  memories: MemoryRecord[],
  livePaths: Iterable<string>,
): MemoryRecord[] {
  const live = buildLivePathIndex(livePaths);
  return memories.filter((m) => m.status === 'active' && isScanMemoryStale(m, live));
}
