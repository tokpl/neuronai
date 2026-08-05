export type ScanMode = 'fast' | 'deep' | 'architecture' | 'update';

export type FileImportance = 'HIGH' | 'MEDIUM' | 'IGNORE' | 'SENSITIVE';

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'php'
  | 'java'
  | 'go'
  | 'rust'
  | 'unknown';

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
  stack: ProjectStackProfile;
  architecture: ArchitectureMap;
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
