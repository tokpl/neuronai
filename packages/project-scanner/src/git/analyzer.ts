import { execFile } from 'node:child_process';
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

    try {
      const { stdout: logOut } = await execFileAsync(
        'git',
        ['log', '-n', '40', '--pretty=format:%s|||%an'],
        { cwd: root, windowsHide: true, maxBuffer: 2_000_000 },
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
          cwd: root,
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
