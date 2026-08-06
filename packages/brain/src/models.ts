import type { MemoryRecord } from '@neuronai/types';

/** Provenance for a DNA facet claim. */
export interface Provenance {
  kind: string;
  ref?: string;
  note?: string;
}

export type FacetSource = 'detect' | 'user' | 'evolve';

/** Single DNA claim with confidence + evidence. */
export interface Facet<T> {
  value: T;
  confidence: number;
  evidence: Provenance[];
  updatedAt: string;
  source: FacetSource;
}

export interface DnaIdentity {
  kind?: Facet<string>;
  audience?: Facet<string>;
  scale?: Facet<string>;
  businessDomain?: Facet<string>;
  projectId?: Facet<string>;
  name?: Facet<string>;
}

export interface DnaStack {
  language?: Facet<string>;
  framework?: Facet<string>;
  runtime?: Facet<string>;
  packageManager?: Facet<string>;
  /** Flattened stack tags (e.g. nextjs, typescript). */
  tags?: Facet<string[]>;
}

export interface DnaStructure {
  style?: Facet<string>;
  modules?: Facet<string[]>;
  entryPoints?: Facet<string[]>;
  boundaries?: Facet<string[]>;
}

export interface DnaPlatforms {
  api?: Facet<string>;
  auth?: Facet<string>;
  data?: Facet<string>;
  validation?: Facet<string>;
  test?: Facet<string>;
  deploy?: Facet<string>;
  ui?: Facet<string>;
  async?: Facet<string>;
}

export interface DnaConventions {
  naming?: Facet<string>;
  patterns?: Facet<string[]>;
  antiPatterns?: Facet<string[]>;
}

export interface DnaRisk {
  criticalModules?: Facet<string[]>;
  hotspots?: Facet<string[]>;
  highRiskAreas?: Facet<string[]>;
}

export interface DnaMeta {
  generatedAt: string;
  scanId?: string;
  overallConfidence: number;
  summary?: string;
}

/** Project DNA — identity of the software inside the Brain. */
export interface ProjectDna {
  version: 1;
  identity: DnaIdentity;
  stack: DnaStack;
  structure: DnaStructure;
  platforms: DnaPlatforms;
  conventions: DnaConventions;
  risk: DnaRisk;
  meta: DnaMeta;
}

export interface KnowledgeGraph {
  nodes: unknown[];
  edges: unknown[];
  changes?: unknown[];
}

/**
 * Single knowledge plane (`.neuron/brain/knowledge.json`).
 * Graph / insights / context live here — not parallel SoT files.
 */
export interface KnowledgePlane {
  version: 1;
  updatedAt: string;
  memory: MemoryRecord[];
  decisions: MemoryRecord[];
  rules: Array<{ id: string; title: string; body: string; critical?: boolean }>;
  graph: KnowledgeGraph;
  insights: Array<{
    id: string;
    title: string;
    content: string;
    kind?: string;
    confidence?: number;
    updatedAt?: string;
  }>;
  context: Array<{
    id: string;
    title: string;
    content: string;
    tags?: string[];
    updatedAt?: string;
  }>;
}

export interface ProjectHealth {
  version: 1;
  updatedAt: string;
  score: number;
  dnaFresh: boolean;
  knowledgeFresh: boolean;
  architectureHealthy: boolean;
  notes: string[];
}

export interface ProjectGoal {
  id: string;
  title: string;
  status: 'active' | 'done' | 'paused';
  updatedAt: string;
}

export interface ProjectGoals {
  version: 1;
  updatedAt: string;
  currentId: string | null;
  goals: ProjectGoal[];
}

export interface ActiveContext {
  version: 1;
  updatedAt: string;
  focus: string | null;
  detail?: string;
  confidence?: number;
}

/** Init answers / local prefs (`.neuron/prefs.json`). */
export interface BrainPrefs {
  schemaVersion: number;
  project: {
    id: string;
    name: string;
    stack: string[];
  };
  privacy: {
    mode: 'suggest' | 'automatic' | 'manual';
    localOnly: boolean;
    telemetry: boolean;
  };
  memory: {
    autoSave: boolean;
    threshold: number;
  };
  integrations?: {
    cursor?: boolean;
  };
  [key: string]: unknown;
}

export interface BrainPaths {
  projectRoot: string;
  neuronDir: string;
  prefs: string;
  brainDir: string;
  dna: string;
  knowledge: string;
  health: string;
  goals: string;
  active: string;
  evolutionDir: string;
  runtimeDir: string;
  store: string;
  cacheDir: string;
  logsDir: string;
  /** @deprecated ephemeral indexes dir kept for cleanup */
  indexesDir: string;
}

/** User-facing `neuron brain` summary. */
export interface BrainStatus {
  healthPercent: number;
  dnaUpdated: boolean;
  knowledgeUpdated: boolean;
  architectureHealthy: boolean;
  currentGoal: string | null;
  activeFocus: string | null;
  confidencePercent: number;
  memoryCount: number;
  decisionCount: number;
}
