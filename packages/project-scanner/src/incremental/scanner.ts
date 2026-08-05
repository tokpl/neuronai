import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ScanCacheEntry, ScannedFile } from '../types.js';

/**
 * Incremental scanning via mtime + content hash - avoid full rescan when possible.
 */
export class IncrementalScanner {
  async loadCache(neuronDir: string): Promise<ScanCacheEntry[]> {
    try {
      const raw = JSON.parse(await readFile(join(neuronDir, 'scan-cache.json'), 'utf8')) as {
        entries: ScanCacheEntry[];
      };
      return raw.entries ?? [];
    } catch {
      return [];
    }
  }

  async saveCache(neuronDir: string, files: ScannedFile[]): Promise<void> {
    const entries: ScanCacheEntry[] = [];
    for (const f of files.slice(0, 20_000)) {
      let hash = `${f.mtimeMs}:${f.size}`;
      if (f.importance === 'HIGH' && f.size < 200_000) {
        try {
          const buf = await readFile(f.absolutePath);
          hash = createHash('sha1').update(buf).digest('hex');
        } catch {
          /* keep mtime hash */
        }
      }
      entries.push({ relativePath: f.relativePath, hash, mtimeMs: f.mtimeMs });
    }
    await mkdir(neuronDir, { recursive: true });
    await writeFile(
      join(neuronDir, 'scan-cache.json'),
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
}

export function createIncrementalScanner(): IncrementalScanner {
  return new IncrementalScanner();
}
