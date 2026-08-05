/**
 * Graph 2.0 relation catalog.
 */
export type { GraphRelationType, GraphEdge, CreateGraphEdgeInput } from '../domain/entities/graph-edge.js';
export { createGraphEdge } from '../domain/entities/graph-edge.js';

/** Core Etap 29 relation set (plus legacy CALLS/USES/etc. still supported). */
export const CORE_RELATION_TYPES = [
  'IMPORTS',
  'DEPENDS_ON',
  'IMPLEMENTS',
  'CREATED_BY',
  'CAUSED',
  'FIXED_BY',
  'REPLACES',
  'VIOLATES',
  'DOCUMENTS',
  'AFFECTS',
  'RELATED_TO',
] as const;
