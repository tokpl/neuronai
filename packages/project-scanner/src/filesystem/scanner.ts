import { readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

import { createFileImportanceAnalyzer } from './importance.js';
import { createLanguageRegistry } from '../languages/registry.js';
import { createSensitiveFileDetector } from '../security/sensitive.js';
import type { ScannedFile } from '../types.js';

export interface FilesystemWalkResult {
  files: ScannedFile[];
  skipped: number;
  truncated: boolean;
}

/**
 * Parallel-friendly directory walk with importance + sensitive filtering.
 * Designed for large trees (queue + concurrency caps).
 */
export class CodebaseScanner {
  private readonly importance = createFileImportanceAnalyzer();
  private readonly languages = createLanguageRegistry();
  private readonly sensitive = createSensitiveFileDetector();

  async walk(
    root: string,
    options: { maxFiles?: number; concurrency?: number } = {},
  ): Promise<FilesystemWalkResult> {
    const maxFiles = options.maxFiles ?? 50_000;
    const files: ScannedFile[] = [];
    let skipped = 0;
    const queue: string[] = [root];

    while (queue.length && files.length < maxFiles) {
      const batch = queue.splice(0, options.concurrency ?? 32);
      const results = await Promise.all(
        batch.map(async (dir) => {
          try {
            return await readdir(dir, { withFileTypes: true });
          } catch {
            return [];
          }
        }),
      );

      for (let i = 0; i < batch.length; i++) {
        const dir = batch[i]!;
        const entries = results[i]!;
        for (const entry of entries) {
          const abs = join(dir, entry.name);
          const rel = relative(root, abs).replace(/\\/g, '/');
          if (entry.isDirectory()) {
            if (this.importance.isIgnoredDir(entry.name)) {
              skipped += 1;
              continue;
            }
            queue.push(abs);
            continue;
          }
          if (!entry.isFile()) continue;
          if (this.sensitive.isSensitive(rel)) {
            skipped += 1;
            continue;
          }
          const imp = this.importance.classify(rel);
          if (imp === 'IGNORE') {
            skipped += 1;
            continue;
          }
          let size = 0;
          let mtimeMs = 0;
          try {
            const st = await stat(abs);
            size = st.size;
            mtimeMs = st.mtimeMs;
          } catch {
            skipped += 1;
            continue;
          }
          files.push({
            relativePath: rel,
            absolutePath: abs,
            ext: extname(entry.name).toLowerCase(),
            size,
            mtimeMs,
            importance: imp,
            language: this.languages.detect(rel),
          });
          if (files.length >= maxFiles) break;
        }
      }
    }

    return { files, skipped, truncated: files.length >= maxFiles && queue.length > 0 };
  }
}

export function createCodebaseScanner(): CodebaseScanner {
  return new CodebaseScanner();
}
