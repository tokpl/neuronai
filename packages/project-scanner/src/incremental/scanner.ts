import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ScanCacheEntry, ScanDelta, ScannedFile } from '../types.js';

/** Regenerable, so it belongs in the ignored cache directory rather than next to the brain. */
function cachePath(neuronDir: string): string {
  return join(neuronDir, 'cache', 'scan-cache.json');
}

/**
 * Change detection between scans.
 *
 * Hashing every important file on every scan made `--update` slower than a full
 * rescan. Unchanged files now reuse their previous hash, so repeat scans only
 * pay for what actually moved.
 */
export class IncrementalScanner {
  async loadCache(neuronDir: string): Promise<ScanCacheEntry[]> {
    try {
      const raw = JSON.parse(await readFile(cachePath(neuronDir), 'utf8')) as {
        entries: ScanCacheEntry[];
      };
      return raw.entries ?? [];
    } catch {
      return [];
    }
  }

  async saveCache(
    neuronDir: string,
    files: ScannedFile[],
    previous: ScanCacheEntry[] = [],
  ): Promise<void> {
    const prior = new Map(previous.map((p) => [p.relativePath, p]));
    const entries: ScanCacheEntry[] = [];

    for (const f of files.slice(0, 20_000)) {
      const old = prior.get(f.relativePath);
      if (old && old.mtimeMs === f.mtimeMs) {
        entries.push(old);
        continue;
      }

      let hash = `${f.mtimeMs}:${f.size}`;
      if (f.importance === 'HIGH' && f.size < 200_000) {
        try {
          hash = createHash('sha1')
            .update(await readFile(f.absolutePath))
            .digest('hex');
        } catch {
          /* keep the mtime hash */
        }
      }
      entries.push({ relativePath: f.relativePath, hash, mtimeMs: f.mtimeMs });
    }

    await mkdir(join(neuronDir, 'cache'), { recursive: true });
    await writeFile(
      cachePath(neuronDir),
      JSON.stringify({ version: 1, entries, updatedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
  }

  changedFiles(current: ScannedFile[], previous: ScanCacheEntry[]): ScannedFile[] {
    const prev = new Map(previous.map((p) => [p.relativePath, p]));
    return current.filter((f) => {
      const old = prev.get(f.relativePath);
      if (!old) return true;
      return old.mtimeMs !== f.mtimeMs;
    });
  }

  /**
   * Explicit delta vs the previous cache. Used for observability and for
   * proving unchanged files are not re-analyzed.
   */
  computeDelta(current: ScannedFile[], previous: ScanCacheEntry[]): ScanDelta {
    const prev = new Map(previous.map((p) => [p.relativePath, p]));
    const curr = new Map(current.map((f) => [f.relativePath, f]));

    const added: string[] = [];
    const changed: string[] = [];
    let unchanged = 0;

    for (const file of current) {
      const old = prev.get(file.relativePath);
      if (!old) {
        added.push(file.relativePath);
        continue;
      }
      if (old.mtimeMs !== file.mtimeMs) {
        changed.push(file.relativePath);
      } else {
        unchanged += 1;
      }
    }

    const deleted: string[] = [];
    for (const path of prev.keys()) {
      if (!curr.has(path)) deleted.push(path);
    }

    return { added, changed, deleted, unchanged, reanalyzed: added.length + changed.length };
  }

  /** True when the file set is byte-for-byte the same shape as the last scan. */
  unchanged(current: ScannedFile[], previous: ScanCacheEntry[]): boolean {
    if (previous.length === 0) return false;
    const delta = this.computeDelta(current, previous);
    return delta.added.length === 0 && delta.changed.length === 0 && delta.deleted.length === 0;
  }
}

export function createIncrementalScanner(): IncrementalScanner {
  return new IncrementalScanner();
}
