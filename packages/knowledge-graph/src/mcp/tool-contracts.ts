/**
 * MCP tool contracts for Knowledge Graph 2.0.
 */
export interface NeuronProjectMapInput {
  projectId?: string;
}

export interface NeuronDependencyTreeInput {
  projectId?: string;
  nodeId?: string;
  name?: string;
  depth?: number;
}

export interface NeuronImpactAnalysisInput {
  projectId?: string;
  target: string;
}

export interface NeuronArchitectureQueryInput {
  projectId?: string;
  question: string;
}

export interface NeuronGraphQueryInput {
  projectId?: string;
  question: string;
}

export interface NeuronRelatedKnowledgeInput {
  projectId?: string;
  query: string;
  limit?: number;
}

export const PLANNED_MCP_TOOLS = [
  {
    name: 'neuron_project_map',
    description: 'Return the project knowledge graph map (modules, deps, top nodes) as JSON.',
    input: 'NeuronProjectMapInput',
  },
  {
    name: 'neuron_graph_query',
    description: 'Graph reasoning / impact map for questions like "What affects authentication?".',
    input: 'NeuronGraphQueryInput',
  },
  {
    name: 'neuron_impact_analysis',
    description: 'Estimate blast radius and impact score for changing a module/service/entity.',
    input: 'NeuronImpactAnalysisInput',
  },
  {
    name: 'neuron_related_knowledge',
    description: 'Traverse graph for related memories, documents, incidents, decisions.',
    input: 'NeuronRelatedKnowledgeInput',
  },
  {
    name: 'neuron_dependency_tree',
    description: 'Return outbound DEPENDS_ON / IMPORTS / USES tree for a node.',
    input: 'NeuronDependencyTreeInput',
  },
  {
    name: 'neuron_architecture_query',
    description: 'Ask architecture questions (auth flow, dependents, related memories).',
    input: 'NeuronArchitectureQueryInput',
  },
] as const;
