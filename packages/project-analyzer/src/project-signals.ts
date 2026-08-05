import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Broader project signals for intelligence (docs, schema, git, config).
 * Used by knowledge-graph / CLI analyze — keeps project-analyzer as the discovery layer.
 */
export interface ProjectSignals {
  documentation: string[];
  schemaFiles: string[];
  configFiles: string[];
  hasGit: boolean;
  recentCommitSubjects: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listMatches(root: string, pred: (name: string) => boolean, max = 40): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || out.length >= max) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= max) return;
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (pred(entry.name)) out.push(full.replace(/\\/g, '/'));
    }
  }
  await walk(root, 0);
  return out;
}

export async function collectProjectSignals(rootPath: string): Promise<ProjectSignals> {
  const documentation = await listMatches(rootPath, (n) =>
    /\.(md|mdx|rst|adoc)$/i.test(n) || n.toLowerCase() === 'readme',
  );
  const schemaFiles = await listMatches(rootPath, (n) =>
    /schema\.prisma|migration|\.sql$/i.test(n) || n === 'drizzle.config.ts',
  );
  const configFiles = await listMatches(rootPath, (n) =>
    /^(tsconfig|jsconfig|webpack|vite\.config|next\.config|neuron\.config)/i.test(n) ||
    n.endsWith('.config.js') ||
    n.endsWith('.config.ts'),
  );

  const hasGit = await exists(join(rootPath, '.git'));
  const recentCommitSubjects: string[] = [];
  if (hasGit) {
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(
        'git',
        ['log', '-5', '--pretty=%s'],
        { cwd: rootPath, windowsHide: true },
      );
      recentCommitSubjects.push(
        ...stdout
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } catch {
      // ignore
    }
  }

  // Touch readme content length as a cheap "documentation present" signal
  if (await exists(join(rootPath, 'README.md'))) {
    await readFile(join(rootPath, 'README.md'), 'utf8').catch(() => '');
  }

  return {
    documentation,
    schemaFiles,
    configFiles,
    hasGit,
    recentCommitSubjects,
  };
}
