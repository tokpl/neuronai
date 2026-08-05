/**
 * Graph 2.0 node category helpers (Code / Architecture / Knowledge / …).
 * Physical storage remains GraphNode + type.
 */
export type {
  GraphNodeType,
  GraphNode,
  CreateGraphNodeInput,
  CodeNodeType,
  ArchitectureNodeType,
  KnowledgeNodeType,
  SecurityNodeType,
  PerformanceNodeType,
  WorkflowNodeType,
} from '../domain/entities/graph-node.js';

export {
  createGraphNode,
  stableNodeId,
  isCodeNode,
  isArchitectureNode,
  isKnowledgeNode,
} from '../domain/entities/graph-node.js';

export const CODE_NODE_TYPES = [
  'FILE',
  'FUNCTION',
  'CLASS',
  'MODULE',
  'COMPONENT',
  'SERVICE',
] as const;

export const ARCHITECTURE_NODE_TYPES = ['DECISION', 'PATTERN', 'RULE', 'PROJECT'] as const;
export const KNOWLEDGE_NODE_TYPES = ['MEMORY', 'DOCUMENT', 'INCIDENT'] as const;
export const SECURITY_NODE_TYPES = ['THREAT', 'FINDING'] as const;
export const PERFORMANCE_NODE_TYPES = ['BOTTLENECK', 'OPTIMIZATION'] as const;
export const WORKFLOW_NODE_TYPES = ['TASK', 'SESSION'] as const;
