import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import type { GitInsight } from '../types.js';

const execFileAsync = promisify(execFile);

const DECISION_RE =
  /\b(migrat\w*|switch(?:ed)? to|replace\w*|adopting|rewrite|move(?:d)? to|introduce\w*)\b/i;

/**
 * Sample git history for potential architecture decisions.
 */
export class GitAnalyzer {
  async analyze(root: string): Promise<GitInsight> {
    const empty: GitInsight = {
      commitsSampled: 0,
      authors: [],
      branches: [],
      potentialDecisions: [],
    };

    if (!root || typeof root !== 'string' || root.includes('\0') || root.includes('..')) {
      return empty;
    }

    try {
      const safeRoot = resolve(root);

      // Explicitly prevent execution outside of a true git repository by verifying
      // the .git directory exists at the root. This prevents git from automatically
      // searching parent directories and executing in an unintended context.
      const gitDirStats = await stat(resolve(safeRoot, '.git')).catch(() => null);
      if (!gitDirStats) {
        return empty;
      }

      const stats = await stat(safeRoot);
      if (!stats.isDirectory()) {
        return empty;
      }

      // SECURITY: Prevent Git directory traversal attacks.
      // If we execute `git` in a directory without a `.git` structure, git will automatically
      // traverse up the tree to find one. If a user provides an arbitrary or nested path,
      // they could leak history/branches from an unintended parent repository.
      try {
        await stat(resolve(safeRoot, '.git'));
      } catch {
        return empty;
      }

      const { stdout: logOut } = await execFileAsync(
        'git',
        ['log', '-n', '40', '--pretty=format:%s|||%an'],
        { cwd: safeRoot, windowsHide: true, maxBuffer: 2_000_000 },
      );
      const lines = logOut.split(/\r?\n/).filter(Boolean);
      const authors = new Set<string>();
      const potentialDecisions: GitInsight['potentialDecisions'] = [];

      for (const line of lines) {
        const [message, author] = line.split('|||');
        if (author) authors.add(author.trim());
        if (message && DECISION_RE.test(message)) {
          potentialDecisions.push({
            message: message.trim(),
            confidence: 0.72,
            reason: 'Commit message suggests architecture migration / major change',
          });
        }
      }

      let branches: string[] = [];
      try {
        const { stdout: br } = await execFileAsync('git', ['branch', '--format=%(refname:short)'], {
          cwd: safeRoot,
          windowsHide: true,
        });
        branches = br.split(/\r?\n/).filter(Boolean).slice(0, 30);
      } catch {
        branches = [];
      }

      return {
        commitsSampled: lines.length,
        authors: [...authors].slice(0, 40),
        branches,
        potentialDecisions: potentialDecisions.slice(0, 20),
      };
    } catch {
      return empty;
    }
  }
}

export function createGitAnalyzer(): GitAnalyzer {
  return new GitAnalyzer();
}
