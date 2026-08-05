import { createChangeClassifier } from './change-classifier.js';
import { sanitizeCommitMessage, sanitizeDiffExcerpt, shortCommit } from './sanitizer.js';
import type { CommitAnalyzeInput, GitChangeMemory } from './types.js';
import { newId, nowIso } from './types.js';

/**
 * Analyze commit message / diff / modules — store summaries only.
 */
export class CommitAnalyzer {
  private readonly classifier = createChangeClassifier();

  analyze(input: CommitAnalyzeInput): GitChangeMemory {
    const files = input.filesChanged?.length
      ? input.filesChanged.map(normalizePath).slice(0, 80)
      : extractFilesFromDiff(input.diff).slice(0, 80);

    const messageSummary = sanitizeCommitMessage(input.message);
    const changeType = this.classifier.classify({
      message: messageSummary,
      files,
    });
    const modulesAffected = modulesFromFiles(files);
    const impact = estimateImpact(files, changeType, input.diff);

    if (input.diff) {
      void sanitizeDiffExcerpt(input.diff, 20);
    }

    return {
      id: newId('gch'),
      commit: shortCommit(input.commit),
      author: (input.author ?? 'unknown').slice(0, 80),
      date: input.date ?? nowIso(),
      filesChanged: files,
      modulesAffected,
      changeType,
      relatedDecisions: (input.relatedDecisions ?? []).map((d) => d.slice(0, 120)).slice(0, 20),
      relatedIncidents: (input.relatedIncidents ?? []).map((d) => d.slice(0, 120)).slice(0, 20),
      relatedDocs: (input.relatedDocs ?? []).map((d) => d.slice(0, 120)).slice(0, 20),
      impact,
      messageSummary,
      effect: effectLine(changeType, modulesAffected),
    };
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').slice(0, 200);
}

function extractFilesFromDiff(diff?: string): string[] {
  if (!diff) return [];
  const files: string[] = [];
  const seen = new Set<string>();
  for (const line of diff.split(/\r?\n/)) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (m) {
      const path = normalizePath(m[2] ?? m[1] ?? '');
      if (path && !seen.has(path)) {
        seen.add(path);
        files.push(path);
      }
    }
  }
  return files;
}

function modulesFromFiles(files: string[]): string[] {
  const mods = new Set<string>();
  for (const f of files) {
    const parts = f.split('/').filter(Boolean);
    if (parts[0] === 'packages' || parts[0] === 'apps') {
      mods.add(parts.slice(0, 2).join('/'));
    } else if (parts[0] === 'src') {
      mods.add(parts.slice(0, Math.min(2, parts.length)).join('/'));
    } else if (parts.length) {
      mods.add(parts[0]!);
    }
  }
  return [...mods].slice(0, 30);
}

function estimateImpact(
  files: string[],
  type: GitChangeMemory['changeType'],
  diff?: string,
): 'low' | 'medium' | 'high' {
  if (type === 'ARCHITECTURE' || type === 'SECURITY') return 'high';
  if (files.length >= 15) return 'high';
  if (files.length >= 5 || type === 'PERFORMANCE' || type === 'REFACTOR') return 'medium';
  if (diff && diff.length > 20_000) return 'high';
  return 'low';
}

function effectLine(
  type: GitChangeMemory['changeType'],
  modules: string[],
): string {
  const where = modules[0] ? ` in ${modules[0]}` : '';
  return `${type.toLowerCase()} change${where}`;
}

export function createCommitAnalyzer(): CommitAnalyzer {
  return new CommitAnalyzer();
}
