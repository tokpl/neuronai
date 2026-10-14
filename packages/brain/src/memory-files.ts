import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MemoryRecord, MemoryType } from '@neuronai/types';

import type { ProjectBrain } from './project-brain.js';

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function toMarkdown(rec: MemoryRecord): string {
  const tags = (rec.tags ?? []).join(', ');
  return [
    '---',
    `id: ${rec.id}`,
    `type: ${rec.type}`,
    `title: ${JSON.stringify(rec.title)}`,
    tags ? `tags: [${tags}]` : null,
    `updatedAt: ${rec.updatedAt}`,
    '---',
    '',
    `# ${rec.title}`,
    '',
    rec.content.trim(),
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: raw };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const meta: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return { meta, body };
}

/** Write one markdown file per memory/decision for reviewable Git diffs. */
export async function syncMemoryMarkdown(brain: ProjectBrain): Promise<number> {
  const dir = brain.paths.memoryDir;
  await mkdir(dir, { recursive: true });
  const records = [...brain.knowledge.memory, ...brain.knowledge.decisions];
  const want = new Set(records.map((r) => `${safeId(r.id)}.md`));

  for (const rec of records) {
    await writeFile(join(dir, `${safeId(rec.id)}.md`), toMarkdown(rec), 'utf8');
  }

  try {
    for (const name of await readdir(dir)) {
      if (!name.endsWith('.md')) continue;
      if (!want.has(name)) await rm(join(dir, name), { force: true });
    }
  } catch {
    // ignore
  }

  return records.length;
}

/** Import markdown files that are not yet in knowledge (team PR adds). */
export async function importMemoryMarkdown(brain: ProjectBrain): Promise<number> {
  const dir = brain.paths.memoryDir;
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }

  const existing = new Set(
    [...brain.knowledge.memory, ...brain.knowledge.decisions].map((r) => r.id),
  );
  let imported = 0;
  const now = new Date().toISOString();

  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    const raw = await readFile(join(dir, name), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const id = meta['id'] ?? name.replace(/\.md$/, '');
    if (existing.has(id)) continue;
    const title = meta['title'] ?? body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
    const type = (meta['type'] as MemoryType | undefined) ?? 'knowledge';
    const content = body.replace(/^#\s+.+\n+/, '').trim() || body;
    const rec: MemoryRecord = {
      id,
      projectId: brain.prefs?.project?.id ?? 'local',
      type,
      title,
      content,
      importanceScore: 0.6,
      confidenceScore: 0.7,
      freshnessScore: 0.8,
      source: 'user',
      status: 'active',
      version: 1,
      tags: meta['tags']
        ? meta['tags']
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : ['imported-md'],
      usageCount: 0,
      lastUsedAt: null,
      embeddingId: null,
      createdAt: meta['updatedAt'] ?? now,
      updatedAt: meta['updatedAt'] ?? now,
    };
    if (type === 'architecture_decision') {
      brain.knowledge.decisions = [...brain.knowledge.decisions, rec];
    } else {
      brain.knowledge.memory = [...brain.knowledge.memory, rec];
    }
    imported += 1;
  }

  return imported;
}
