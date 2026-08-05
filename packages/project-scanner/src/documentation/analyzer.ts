import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DocInsight, ScannedFile } from '../types.js';

export class DocumentationAnalyzer {
  async analyze(root: string, files: ScannedFile[]): Promise<DocInsight> {
    const docFiles = files
      .filter((f) => /\.(md|mdx)$/i.test(f.relativePath))
      .map((f) => f.relativePath)
      .slice(0, 40);

    let readmeSummary: string | null = null;
    const knowledgeBullets: string[] = [];

    for (const name of ['README.md', 'readme.md', 'README.MD']) {
      try {
        const raw = await readFile(join(root, name), 'utf8');
        readmeSummary = summarize(raw);
        knowledgeBullets.push(...extractBullets(raw).slice(0, 12));
        break;
      } catch {
        /* try next */
      }
    }

    for (const f of files.filter((x) => x.relativePath.toLowerCase().startsWith('docs/')).slice(0, 5)) {
      try {
        const raw = await readFile(f.absolutePath, 'utf8');
        knowledgeBullets.push(...extractBullets(raw).slice(0, 4));
      } catch {
        /* ignore */
      }
    }

    return {
      readmeSummary,
      docFiles,
      knowledgeBullets: [...new Set(knowledgeBullets)].slice(0, 30),
    };
  }
}

function summarize(md: string): string {
  const lines = md
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('```'));
  return lines.slice(0, 3).join(' ').slice(0, 400);
}

function extractBullets(md: string): string[] {
  return md
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, ''))
    .filter((l) => l.length > 12 && l.length < 200);
}

export function createDocumentationAnalyzer(): DocumentationAnalyzer {
  return new DocumentationAnalyzer();
}
