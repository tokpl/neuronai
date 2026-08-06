import type { CodeIntelligence, MemoryRecord } from '@neuronai/types';

export type {
  CodeEdge,
  CodeEdgeType,
  CodeEvidence,
  CodeFileNode,
  CodeIntelligence,
  CodeSymbolKind,
  CodeSymbolNode,
  RelationConfidence,
} from '@neuronai/types';

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

export type ProjectMapKind = 'module' | 'file' | 'symbol' | 'route';

/**
 * One thing the project contains, and where it actually lives.
 *
 * `path` is always repository-relative and complete — never a bare filename.
 * Answering "where is X?" is the whole reason this exists.
 */
export interface ProjectMapEntry {
  kind: ProjectMapKind;
  /** Module name, file path, symbol name, or "POST /api/users". */
  name: string;
  /** Repository-relative path. Directories end with `/`. */
  path: string;
  /** Short human description, when the scanner can infer one honestly. */
  purpose?: string;
  /** Owning module name, when known. */
  module?: string;
  /** Canonical concepts this entry relates to (see retrieval/concepts). */
  concepts?: string[];
}

/**
 * Where things are. Rebuilt by `neuron scan`, so deleted files disappear
 * instead of lingering as confidently wrong locations.
 */
export interface ProjectMap {
  version: 1;
  updatedAt: string;
  entries: ProjectMapEntry[];
}

/**
 * Single knowledge plane (`.neuron/brain/knowledge.json`).
 * The graph and the project map live here too — not in parallel files.
 */
export interface KnowledgePlane {
  version: 1;
  updatedAt: string;
  memory: MemoryRecord[];
  decisions: MemoryRecord[];
  rules: Array<{ id: string; title: string; body: string; critical?: boolean }>;
  graph: KnowledgeGraph;
  map?: ProjectMap;
  /**
   * Structural code intelligence (symbols, verified relationships, summaries).
   * Lives in the same knowledge plane — not a second index.
   */
  code?: CodeIntelligence;
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
  runtimeDir: string;
  store: string;
  cacheDir: string;
}

/** User-facing `neuron brain` summary. */
export interface BrainStatus {
  healthPercent: number;
  dnaUpdated: boolean;
  knowledgeUpdated: boolean;
  architectureHealthy: boolean;
  confidencePercent: number;
  memoryCount: number;
  decisionCount: number;
}
