import { readFile } from 'node:fs/promises';

import type { CodeRelationship, ScannedFile } from '../types.js';

/**
 * Lightweight multi-language relationship extraction (imports / extends / implements).
 * Extensible - no full AST required for bootstrap.
 */
export class CodeRelationshipAnalyzer {
  async analyze(
    files: ScannedFile[],
    options: { maxFiles?: number; concurrency?: number } = {},
  ): Promise<CodeRelationship[]> {
    const candidates = files
      .filter((f) => f.importance === 'HIGH' && f.language !== 'unknown')
      .slice(0, options.maxFiles ?? 400);

    const relationships: CodeRelationship[] = [];
    const concurrency = options.concurrency ?? 16;

    for (let i = 0; i < candidates.length; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      const texts = await Promise.all(
        batch.map(async (f) => {
          try {
            const raw = await readFile(f.absolutePath, 'utf8');
            return { file: f, text: raw.slice(0, 80_000) };
          } catch {
            return null;
          }
        }),
      );

      for (const item of texts) {
        if (!item) continue;
        relationships.push(...extract(item.file.relativePath, item.text, item.file.language));
      }
    }

    return relationships.slice(0, 5_000);
  }
}

function extract(fromFile: string, text: string, language: string): CodeRelationship[] {
  const out: CodeRelationship[] = [];
  const add = (toModule: string, kind: CodeRelationship['kind']) => {
    if (!toModule || toModule.startsWith('.')) {
      /* keep relative imports too */
    }
    out.push({ fromFile, toModule: toModule.replace(/['"]/g, ''), kind });
  };

  if (language === 'javascript' || language === 'typescript') {
    for (const m of text.matchAll(/import\s+[^'"]*from\s+['"]([^'"]+)['"]/g)) add(m[1]!, 'import');
    for (const m of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]!, 'import');
    for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|class|const)\s+(\w+)/g)) {
      add(m[1]!, 'export');
    }
    for (const m of text.matchAll(/extends\s+(\w+)/g)) add(m[1]!, 'extends');
    for (const m of text.matchAll(/implements\s+([\w,\s]+)/g)) {
      for (const name of m[1]!.split(',')) add(name.trim(), 'implements');
    }
  } else if (language === 'python') {
    for (const m of text.matchAll(/^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm)) {
      add((m[1] ?? m[2])!, 'import');
    }
  } else if (language === 'php') {
    for (const m of text.matchAll(/use\s+([\w\\]+)/g)) add(m[1]!, 'import');
    for (const m of text.matchAll(/extends\s+(\w+)/g)) add(m[1]!, 'extends');
    for (const m of text.matchAll(/implements\s+([\w,\s\\]+)/g)) {
      for (const name of m[1]!.split(',')) add(name.trim(), 'implements');
    }
  } else if (language === 'java') {
    for (const m of text.matchAll(/import\s+([\w.]+);/g)) add(m[1]!, 'import');
    for (const m of text.matchAll(/extends\s+(\w+)/g)) add(m[1]!, 'extends');
    for (const m of text.matchAll(/implements\s+([\w,\s]+)/g)) {
      for (const name of m[1]!.split(',')) add(name.trim(), 'implements');
    }
  } else if (language === 'go') {
    for (const m of text.matchAll(/import\s+(?:\(\s*)?"([^"]+)"/g)) add(m[1]!, 'import');
  } else if (language === 'rust') {
    for (const m of text.matchAll(/use\s+([\w:]+)/g)) add(m[1]!, 'import');
  }

  return out.slice(0, 80);
}

export function createCodeRelationshipAnalyzer(): CodeRelationshipAnalyzer {
  return new CodeRelationshipAnalyzer();
}
