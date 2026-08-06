import { readFile } from 'node:fs/promises';

import type { CodeRelationship, ScannedFile } from '../types.js';

/**
 * Lightweight, deterministic symbol and HTTP-route hints.
 * Not a language server — only patterns we can trust.
 */
export async function extractSymbols(
  files: ScannedFile[],
  options: { maxFiles?: number; concurrency?: number } = {},
): Promise<CodeRelationship[]> {
  const candidates = files
    .filter((f) => f.importance === 'HIGH' && (f.language === 'typescript' || f.language === 'javascript'))
    .slice(0, options.maxFiles ?? 200);

  const out: CodeRelationship[] = [];
  const concurrency = options.concurrency ?? 16;

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const texts = await Promise.all(
      batch.map(async (f) => {
        try {
          const raw = await readFile(f.absolutePath, 'utf8');
          return { file: f, text: raw.slice(0, 60_000) };
        } catch {
          return null;
        }
      }),
    );

    for (const item of texts) {
      if (!item) continue;
      out.push(...fromSource(item.file.relativePath.replace(/\\/g, '/'), item.text));
    }
  }

  return out.slice(0, 2_000);
}

function fromSource(fromFile: string, text: string): CodeRelationship[] {
  const out: CodeRelationship[] = [];

  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|type|interface)\s+(\w+)/g)) {
    out.push({ fromFile, toModule: m[1]!, kind: 'export' });
  }

  for (const m of text.matchAll(
    /\b(?:app|router|server)\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]/gi,
  )) {
    const method = m[1]!.toUpperCase();
    const path = m[2]!;
    out.push({ fromFile, toModule: `${method} ${path}`, kind: 'export' });
  }

  return out.slice(0, 40);
}
