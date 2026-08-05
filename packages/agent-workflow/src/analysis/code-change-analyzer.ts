export type ChangeKind =
  | 'feature'
  | 'refactor'
  | 'bugfix'
  | 'dependency'
  | 'schema'
  | 'docs'
  | 'test'
  | 'config'
  | 'unknown';

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';
  additions?: number;
  deletions?: number;
}

export interface CodeChangeAnalysis {
  filesChanged: number;
  changeKind: ChangeKind;
  modules: string[];
  impact: 'low' | 'medium' | 'high';
  summary: string;
  signals: string[];
  /** Raw paths for rule engine */
  paths: string[];
  hasDependencyChange: boolean;
  hasSchemaChange: boolean;
  hasAuthChange: boolean;
  hasArchitectureHint: boolean;
}

const SCHEMA_RE =
  /migration|schema\.prisma|drizzle\/|sequelize|alembic|flyway|\.sql$|create.?table|alter.?table/i;
const AUTH_RE = /auth|permission|rbac|oauth|jwt|session/i;
const DEP_FILES = /(^|\/)(package\.json|pnpm-lock\.yaml|yarn\.lock|package-lock\.json|composer\.json|requirements\.txt|Cargo\.toml|go\.mod)$/i;
const ARCH_HINT_RE = /architecture|refactor|rewrite|migrate|replace|redesign/i;

function moduleFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  // Drop filename - modules are directory prefixes
  const dirs = parts.slice(0, -1);
  if (dirs.length === 0) return 'root';
  if (dirs[0] === 'apps' || dirs[0] === 'packages') {
    return dirs.slice(0, Math.min(2, dirs.length)).join('/');
  }
  if (dirs[0] === 'src') {
    return dirs.slice(0, Math.min(2, dirs.length)).join('/');
  }
  return dirs.slice(0, Math.min(2, dirs.length)).join('/');
}

function parseDiffPaths(diff: string): FileChange[] {
  const files: FileChange[] = [];
  const seen = new Set<string>();
  for (const line of diff.split(/\r?\n/)) {
    const gitDiff = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gitDiff) {
      const path = gitDiff[2] ?? gitDiff[1] ?? '';
      if (path && !seen.has(path)) {
        seen.add(path);
        files.push({ path, status: 'modified' });
      }
      continue;
    }
    const plusPlus = line.match(/^\+\+\+ [ab]\/(.+)$/);
    if (plusPlus?.[1] && plusPlus[1] !== '/dev/null' && !seen.has(plusPlus[1])) {
      seen.add(plusPlus[1]);
      files.push({ path: plusPlus[1], status: 'modified' });
    }
    const newFile = line.match(/^new file mode/);
    if (newFile && files.length > 0) {
      files[files.length - 1]!.status = 'added';
    }
    const deleted = line.match(/^deleted file mode/);
    if (deleted && files.length > 0) {
      files[files.length - 1]!.status = 'deleted';
    }
  }
  return files;
}

function inferChangeKind(input: {
  paths: string[];
  message?: string;
  signals: string[];
}): ChangeKind {
  const blob = `${input.paths.join('\n')}\n${input.message ?? ''}`;
  if (SCHEMA_RE.test(blob) || input.signals.includes('schema')) return 'schema';
  if (input.paths.some((p) => DEP_FILES.test(p)) || input.signals.includes('dependency')) {
    return 'dependency';
  }
  if (/\b(test|spec)\b/i.test(blob) && input.paths.every((p) => /test|spec|__tests__/i.test(p))) {
    return 'test';
  }
  if (/\.md$/i.test(blob) || /docs\//i.test(blob)) return 'docs';
  if (ARCH_HINT_RE.test(input.message ?? '') || input.signals.includes('refactor')) {
    return 'refactor';
  }
  if (/fix|bug|hotfix/i.test(input.message ?? '')) return 'bugfix';
  if (/feat|add|implement/i.test(input.message ?? '')) return 'feature';
  return 'unknown';
}

function impactFrom(analysis: {
  filesChanged: number;
  changeKind: ChangeKind;
  hasAuthChange: boolean;
  hasSchemaChange: boolean;
  hasArchitectureHint: boolean;
}): 'low' | 'medium' | 'high' {
  if (analysis.hasSchemaChange || analysis.hasAuthChange || analysis.hasArchitectureHint) {
    return 'high';
  }
  if (analysis.changeKind === 'refactor' || analysis.changeKind === 'dependency') return 'medium';
  if (analysis.filesChanged >= 8) return 'high';
  if (analysis.filesChanged >= 3) return 'medium';
  return 'low';
}

/**
 * Analyze a git diff (and optional commit message) without calling an LLM.
 */
export class CodeChangeAnalyzer {
  analyze(input: {
    diff?: string;
    files?: string[];
    message?: string;
  }): CodeChangeAnalysis {
    const fromDiff = input.diff ? parseDiffPaths(input.diff) : [];
    const fromList = (input.files ?? []).map((path) => ({
      path,
      status: 'modified' as const,
    }));
    const merged = new Map<string, FileChange>();
    for (const f of [...fromDiff, ...fromList]) {
      merged.set(f.path, f);
    }
    const changes = [...merged.values()];
    const paths = changes.map((c) => c.path);
    const modules = [...new Set(paths.map(moduleFromPath))];

    const signals: string[] = [];
    const blob = `${paths.join('\n')}\n${input.message ?? ''}\n${input.diff ?? ''}`;

    const hasSchemaChange = SCHEMA_RE.test(blob);
    const hasAuthChange = AUTH_RE.test(blob);
    const hasDependencyChange = paths.some((p) => DEP_FILES.test(p)) || /"dependencies"/i.test(input.diff ?? '');
    const hasArchitectureHint = ARCH_HINT_RE.test(input.message ?? '') || /architecture/i.test(blob);

    if (hasSchemaChange) signals.push('schema');
    if (hasAuthChange) signals.push('auth');
    if (hasDependencyChange) signals.push('dependency');
    if (hasArchitectureHint) signals.push('architecture');
    if (/refactor|rewrite/i.test(input.message ?? '')) signals.push('refactor');

    const changeKind = inferChangeKind({ paths, message: input.message, signals });
    const filesChanged = changes.length || (input.files?.length ?? 0);

    let summary = 'Code changes detected';
    if (hasAuthChange) summary = 'Authentication architecture changed';
    else if (hasSchemaChange) summary = 'Database schema / migration changed';
    else if (hasDependencyChange) summary = 'Project dependencies changed';
    else if (changeKind === 'refactor') summary = 'Refactor / architecture-oriented change';
    else if (modules.length === 1) summary = `Changes concentrated in ${modules[0]}`;
    else if (modules.length > 1) summary = `Cross-module change (${modules.slice(0, 3).join(', ')})`;

    const base = {
      filesChanged,
      changeKind,
      hasAuthChange,
      hasSchemaChange,
      hasArchitectureHint,
    };

    return {
      filesChanged,
      changeKind,
      modules,
      impact: impactFrom(base),
      summary,
      signals,
      paths,
      hasDependencyChange,
      hasSchemaChange,
      hasAuthChange,
      hasArchitectureHint,
    };
  }
}

export function createCodeChangeAnalyzer(): CodeChangeAnalyzer {
  return new CodeChangeAnalyzer();
}
