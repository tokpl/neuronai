import type { CodeIntelligence } from '@neuronai/types';

export type ScanMode = 'fast' | 'deep' | 'architecture' | 'update';

export type FileImportance = 'HIGH' | 'MEDIUM' | 'IGNORE' | 'SENSITIVE';

export type SupportedLanguage =
  'javascript' | 'typescript' | 'python' | 'php' | 'java' | 'go' | 'rust' | 'unknown';

export interface ScannedFile {
  relativePath: string;
  absolutePath: string;
  ext: string;
  size: number;
  mtimeMs: number;
  importance: FileImportance;
  language: SupportedLanguage;
}

export interface ProjectStackProfile {
  frontend: string[];
  backend: string[];
  database: string[];
  tools: string[];
  languages: string[];
  packageManagers: string[];
  manifests: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  relation: 'USES' | 'DEPENDS_ON' | 'IMPORTS';
}

export interface ArchitectureMap {
  modules: string[];
  services: string[];
  controllers: string[];
  repositories: string[];
  components: string[];
  routes: string[];
  databaseLayers: string[];
  /** Cross-cutting middleware files (auth, rate-limit, …). */
  middleware: string[];
  /** Likely application entrypoints (main, index, server, app). */
  entrypoints: string[];
  markdown: string;
}

export interface CodeRelationship {
  fromFile: string;
  toModule: string;
  kind: 'import' | 'export' | 'extends' | 'implements' | 'calls';
}

export interface GitInsight {
  commitsSampled: number;
  authors: string[];
  branches: string[];
  potentialDecisions: Array<{ message: string; confidence: number; reason: string }>;
}

export interface DocInsight {
  readmeSummary: string | null;
  docFiles: string[];
  knowledgeBullets: string[];
}

export interface GeneratedMemory {
  title: string;
  content: string;
  type: 'architecture_decision' | 'knowledge' | 'pattern' | 'mistake' | 'dependency';
  confidence: number;
  source: string;
  tags: string[];
  /** Repo-relative paths that evidence this claim. Empty = not path-grounded. */
  paths?: string[];
}

/** Explicit file-set delta for incremental scans. */
export interface ScanDelta {
  added: string[];
  changed: string[];
  deleted: string[];
  unchanged: number;
  /** Files whose contents were deeply re-analyzed (relationships/symbols). */
  reanalyzed: number;
}

export interface SuggestedRule {
  rule: string;
  reason: string;
  confidence: number;
}

export interface ScanCacheEntry {
  relativePath: string;
  hash: string;
  mtimeMs: number;
}

export interface ProjectMapEntry {
  kind: 'module' | 'file' | 'symbol' | 'route';
  name: string;
  path: string;
  purpose?: string;
  module?: string;
  concepts?: string[];
}

export interface ProjectMapSnapshot {
  version: 1;
  updatedAt: string;
  entries: ProjectMapEntry[];
}

export interface ProjectScanReport {
  projectName: string;
  mode: ScanMode;
  scannedAt: string;
  filesScanned: number;
  filesSkipped: number;
  modules: number;
  services: number;
  dependencies: number;
  memoriesCreated: number;
  relationships: number;
  rulesSuggested: number;
  /** True when an `update` scan found no changes and skipped re-analysis. */
  unchanged?: boolean;
  /** Present on update scans (and full scans that compared a prior cache). */
  delta?: ScanDelta;
  stack: ProjectStackProfile;
  architecture: ArchitectureMap;
  /** Retrievable locations — modules, files, symbols, routes. */
  map: ProjectMapSnapshot;
  /** Structural code intelligence (TS/JS deep; other langs shallow via relationships). */
  code?: CodeIntelligence;
  dependencyGraph: DependencyEdge[];
  relationshipsList: CodeRelationship[];
  memories: GeneratedMemory[];
  suggestedRules: SuggestedRule[];
  git: GitInsight;
  docs: DocInsight;
  markdown: string;
  architectureMarkdown: string;
  constitutionMarkdown: string;
  cursorRulesMarkdown: string;
}

export interface ScanOptions {
  root: string;
  mode?: ScanMode;
  projectName?: string;
  /** Max files to deeply inspect (content) */
  maxDeepFiles?: number;
  /** Parallelism for content reads */
  concurrency?: number;
  previousCache?: ScanCacheEntry[];
}

export function nowIso(): string {
  return new Date().toISOString();
}
