/** Internal module architecture — not a public plugin SDK. */

export type ModuleName =
  | 'memory'
  | 'graph'
  | 'retrieval'
  | 'decision'
  | 'ai-provider'
  | 'security'
  | 'performance'
  | 'documentation'
  | 'evaluation'
  | 'workflow';

export type ModuleState =
  | 'registered'
  | 'loaded'
  | 'initialized'
  | 'running'
  | 'stopped'
  | 'failed';

export type NeuronEventType =
  | 'MemoryCreated'
  | 'MemoryUpdated'
  | 'GraphChanged'
  | 'DecisionCreated'
  | 'AnalysisCompleted'
  | 'ProjectScanned';

export type ErrorCategory =
  | 'module'
  | 'storage'
  | 'config'
  | 'migration'
  | 'provider'
  | 'internal';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ModuleCapability {
  id: string;
  description: string;
}

export interface ModuleManifest {
  name: ModuleName;
  version: string;
  /** Other module names this module needs */
  dependencies: ModuleName[];
  capabilities: ModuleCapability[];
  /** Workspace package this module maps to (compile-time only) */
  packageName: string;
}

export interface ModuleHealth {
  name: ModuleName;
  ok: boolean;
  state: ModuleState;
  detail: string;
  checkedAt: string;
}

export interface NeuronEvent<T = unknown> {
  type: NeuronEventType;
  module: ModuleName | 'core';
  payload: T;
  at: string;
}

export interface NeuronErrorShape {
  category: ErrorCategory;
  severity: ErrorSeverity;
  module: ModuleName | 'core';
  message: string;
  solutionHint: string;
  cause?: string;
}

export interface MigrationStep {
  id: string;
  fromVersion: string;
  toVersion: string;
  target: 'memory' | 'graph' | 'config' | 'module';
  description: string;
  apply: (ctx: MigrationContext) => Promise<void> | void;
}

export interface MigrationContext {
  neuronDir: string;
  dryRun: boolean;
  log: string[];
}

export interface ConfigLayer {
  source: 'default' | 'env' | 'project';
  values: Record<string, unknown>;
}

export interface ResolvedNeuronConfig {
  values: Record<string, unknown>;
  layers: ConfigLayer[];
  /** project > env > default */
  priority: ['project', 'env', 'default'];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Semver compare: -1 if a<b, 0 equal, 1 if a>b (major.minor.patch only). */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((x) => Number(x) || 0);
  const pb = b.replace(/^v/, '').split('.').map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function isCompatible(required: string, actual: string): boolean {
  // Compatible if same major and actual >= required minor/patch
  const ra = required.replace(/^v/, '').split('.').map((x) => Number(x) || 0);
  const aa = actual.replace(/^v/, '').split('.').map((x) => Number(x) || 0);
  if ((ra[0] ?? 0) !== (aa[0] ?? 0)) return false;
  return compareSemver(actual, required) >= 0;
}
