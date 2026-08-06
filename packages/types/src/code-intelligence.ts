/**
 * Structural code intelligence stored inside ProjectBrain knowledge.code.
 * Prefer missing edges over wrong ones — every edge carries evidence + confidence.
 */

export type RelationConfidence = 'high' | 'medium' | 'low';

export type CodeEdgeType =
  | 'IMPORTS'
  | 'EXPORTS'
  | 'CALLS'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'REFERENCES'
  | 'ROUTE_TO'
  | 'DEFINED_IN'
  | 'BELONGS_TO';

export type CodeSymbolKind =
  | 'class'
  | 'function'
  | 'method'
  | 'interface'
  | 'type'
  | 'const'
  | 'route'
  | 'unknown';

/** Short, human-readable proof for a relationship. */
export interface CodeEvidence {
  kind: 'import' | 'export' | 'call' | 'route' | 'extends' | 'implements' | 'reference' | 'structure';
  detail: string;
}

export interface CodeFileNode {
  path: string;
  role?: string;
  /** Resolved repo-relative import targets (local files only). */
  imports: string[];
  /** Exported symbol names. */
  exports: string[];
  concepts?: string[];
  /** Deterministic one-liner — never LLM-required. */
  summary?: string;
}

/**
 * Stable identity: `path#Name` or `path#Parent.Name`.
 * Line numbers are never part of the id.
 */
export interface CodeSymbolNode {
  id: string;
  name: string;
  kind: CodeSymbolKind;
  path: string;
  parent?: string;
  role?: string;
  concepts?: string[];
  summary?: string;
  exported?: boolean;
}

export interface CodeEdge {
  from: string;
  to: string;
  type: CodeEdgeType;
  confidence: RelationConfidence;
  evidence: CodeEvidence;
}

export interface CodeIntelligence {
  version: 1;
  updatedAt: string;
  files: CodeFileNode[];
  symbols: CodeSymbolNode[];
  edges: CodeEdge[];
}

export function emptyCodeIntelligence(updatedAt = new Date().toISOString()): CodeIntelligence {
  return { version: 1, updatedAt, files: [], symbols: [], edges: [] };
}

/** Build a stable symbol id. */
export function symbolId(path: string, name: string, parent?: string): string {
  const p = path.replace(/\\/g, '/');
  return parent ? `${p}#${parent}.${name}` : `${p}#${name}`;
}
