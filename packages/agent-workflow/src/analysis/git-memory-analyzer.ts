import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { CodeChangeAnalyzer, type CodeChangeAnalysis } from './code-change-analyzer.js';

const execFileAsync = promisify(execFile);

export interface GitCommitInfo {
  hash: string;
  message: string;
  branch: string;
  files: string[];
  diff: string;
}

export interface GitAnalysisResult {
  commit: GitCommitInfo;
  analysis: CodeChangeAnalysis;
  suggestedDecisionTitle?: string;
}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * Read local git state and map commits/diffs into CodeChangeAnalysis.
 */
export class GitMemoryAnalyzer {
  private readonly analyzer = new CodeChangeAnalyzer();

  constructor(private readonly cwd = process.cwd()) {}

  async currentBranch(): Promise<string> {
    return (await git(this.cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])) || 'unknown';
  }

  async workingTreeDiff(): Promise<string> {
    const staged = await git(this.cwd, ['diff', '--cached']);
    const unstaged = await git(this.cwd, ['diff']);
    return [staged, unstaged].filter(Boolean).join('\n');
  }

  async latestCommit(): Promise<GitCommitInfo | null> {
    const hash = await git(this.cwd, ['rev-parse', 'HEAD']);
    if (!hash) return null;
    const message = await git(this.cwd, ['log', '-1', '--pretty=%B']);
    const branch = await this.currentBranch();
    const filesRaw = await git(this.cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
    const files = filesRaw ? filesRaw.split(/\r?\n/).filter(Boolean) : [];
    const diff = await git(this.cwd, ['show', '--pretty=format:', '--patch', 'HEAD']);
    return { hash, message, branch, files, diff };
  }

  async analyzeLatestCommit(): Promise<GitAnalysisResult | null> {
    const commit = await this.latestCommit();
    if (!commit) return null;
    return this.analyzeCommit(commit);
  }

  analyzeCommit(commit: Pick<GitCommitInfo, 'message' | 'files' | 'diff' | 'hash' | 'branch'>): GitAnalysisResult {
    const analysis = this.analyzer.analyze({
      diff: commit.diff,
      files: commit.files,
      message: commit.message,
    });

    let suggestedDecisionTitle: string | undefined;
    if (analysis.hasArchitectureHint || analysis.impact === 'high') {
      const firstLine = commit.message.split(/\r?\n/)[0]?.trim() ?? 'Architecture change';
      suggestedDecisionTitle = firstLine.slice(0, 120);
    }

    return {
      commit: {
        hash: commit.hash,
        message: commit.message,
        branch: commit.branch,
        files: commit.files,
        diff: commit.diff,
      },
      analysis,
      suggestedDecisionTitle,
    };
  }

  async analyzeWorkingTree(message?: string): Promise<CodeChangeAnalysis> {
    const diff = await this.workingTreeDiff();
    return this.analyzer.analyze({ diff, message });
  }
}

export function createGitMemoryAnalyzer(cwd = process.cwd()): GitMemoryAnalyzer {
  return new GitMemoryAnalyzer(cwd);
}
