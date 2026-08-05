export type { GraphNodeType, GraphNode, CreateGraphNodeInput } from './domain/entities/graph-node.js';
export {
  createGraphNode,
  stableNodeId,
  isCodeNode,
  isArchitectureNode,
  isKnowledgeNode,
} from './domain/entities/graph-node.js';

export type { GraphRelationType, GraphEdge, CreateGraphEdgeInput } from './domain/entities/graph-edge.js';
export { createGraphEdge } from './domain/entities/graph-edge.js';

export type { GraphChangeKind, GraphChangeRecord } from './domain/entities/graph-change.js';
export { createGraphChange } from './domain/entities/graph-change.js';

export type { GraphRepository } from './repositories/graph-repository.js';
export {
  InMemoryGraphRepository,
  createInMemoryGraphRepository,
} from './repositories/in-memory-graph-repository.js';
export {
  FileGraphRepository,
  createFileGraphRepository,
} from './repositories/file-graph-repository.js';

export type {
  LanguageAnalyzer,
  LanguageAnalysis,
  ImportRef,
  ExportSymbol,
} from './analyzers/language-analyzer.js';
export { pickAnalyzer } from './analyzers/language-analyzer.js';
export { TypeScriptAnalyzer, createTypeScriptAnalyzer } from './analyzers/typescript-analyzer.js';
export { PHPAnalyzer, PythonAnalyzer, JavaAnalyzer } from './analyzers/language-stubs.js';
export {
  DependencyScanner,
  createDependencyScanner,
  type ScannedDependency,
} from './analyzers/dependency-scanner.js';
export {
  CodeGraphAnalyzer,
  createCodeGraphAnalyzer,
} from './analyzers/code-graph-analyzer.js';

export {
  GraphSearchEngine,
  createGraphSearchEngine,
  type GraphNeighborHit,
  type ImpactPath,
} from './services/graph-search-engine.js';
export {
  ImpactAnalyzer,
  createImpactAnalyzer,
  type ImpactReport,
} from './services/impact-analyzer.js';
export {
  GraphUpdateEngine,
  createGraphUpdateEngine,
  type GraphUpdateTrigger,
} from './services/graph-update-engine.js';
export {
  MemoryGraphLinker,
  createMemoryGraphLinker,
} from './services/memory-graph-linker.js';
export {
  ArchitectureQueryService,
  createArchitectureQueryService,
  type ArchitectureAnswer,
} from './services/architecture-query.js';
export {
  ProjectIntelligenceEngine,
  createProjectIntelligenceEngine,
  type ProjectIntelligenceResult,
} from './services/project-intelligence-engine.js';

export { exportGraphJson, type GraphJsonExport } from './export/graph-json-export.js';
export { writeGraphVisualization } from './visualization/export.js';
export * from './git/index.js';
export {
  GraphReasoner,
  createGraphReasoner,
  type ImpactMap,
  type ImpactMapStep,
} from './queries/graph-reasoner.js';
export {
  NodeImportanceScorer,
  createNodeImportanceScorer,
  type NodeImportanceScore,
} from './ranking/importance.js';
export {
  IndexedGraphCache,
  createIndexedGraphCache,
  type IndexedGraphCacheView,
} from './storage/indexed-cache.js';
export {
  CODE_NODE_TYPES,
  ARCHITECTURE_NODE_TYPES,
  KNOWLEDGE_NODE_TYPES,
  SECURITY_NODE_TYPES,
  PERFORMANCE_NODE_TYPES,
  WORKFLOW_NODE_TYPES,
} from './nodes/index.js';
export { CORE_RELATION_TYPES } from './edges/index.js';

export {
  PLANNED_MCP_TOOLS,
  type NeuronProjectMapInput,
  type NeuronDependencyTreeInput,
  type NeuronImpactAnalysisInput,
  type NeuronArchitectureQueryInput,
  type NeuronGraphQueryInput,
  type NeuronRelatedKnowledgeInput,
} from './mcp/tool-contracts.js';

import { createInMemoryGraphRepository } from './repositories/in-memory-graph-repository.js';
import { createGraphSearchEngine } from './services/graph-search-engine.js';

/** Back-compat helper used by early tests / callers. */
export function createKnowledgeGraph(projectId?: string) {
  const graph = createInMemoryGraphRepository();
  const search = createGraphSearchEngine(graph);
  return {
    graph,
    search,
    async neighbors(entityId: string, depth = 1) {
      const node = await graph.getNode(entityId);
      const pid = node?.projectId ?? projectId;
      if (!pid) return [];
      const hits = await search.neighbors(pid, entityId, { depth });
      return hits.map((h) => ({
        id: h.node.id,
        relationType: h.edge.relationType.toLowerCase() as string,
      }));
    },
  };
}
