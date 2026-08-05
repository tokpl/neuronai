import { BaseNeuronModule } from '../interfaces/neuron-module.js';
import type { ModuleCapability, ModuleName } from '../types.js';

function caps(...items: Array<[string, string]>): ModuleCapability[] {
  return items.map(([id, description]) => ({ id, description }));
}

/** Memory Engine module descriptor — maps to @neuron-ai-memory/memory-engine */
export class MemoryModule extends BaseNeuronModule {
  readonly name = 'memory' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = [];
  readonly packageName = '@neuron-ai-memory/memory-engine';
  readonly capabilities = caps(
    ['memory.store', 'Create and update engineering memories'],
    ['memory.search', 'Search local memory store'],
  );
}

export class GraphModule extends BaseNeuronModule {
  readonly name = 'graph' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['memory'];
  readonly packageName = '@neuron-ai-memory/knowledge-graph';
  readonly capabilities = caps(
    ['graph.query', 'Knowledge graph queries'],
    ['graph.impact', 'Impact analysis'],
  );
}

export class RetrievalModule extends BaseNeuronModule {
  readonly name = 'retrieval' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['memory', 'graph'];
  readonly packageName = '@neuron-ai-memory/retrieval-engine';
  readonly capabilities = caps(['retrieval.assemble', 'Assemble task context']);
}

export class DecisionModule extends BaseNeuronModule {
  readonly name = 'decision' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['memory', 'graph'];
  readonly packageName = '@neuron-ai-memory/decision-engine';
  readonly capabilities = caps(['decision.reason', 'Evidence-based recommendations']);
}

export class AIProviderModule extends BaseNeuronModule {
  readonly name = 'ai-provider' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['security'];
  readonly packageName = '@neuron-ai-memory/ai-runtime';
  readonly capabilities = caps(
    ['ai.route', 'Route to local/cloud providers'],
    ['ai.embed', 'Embeddings via providers'],
  );
}

export class SecurityModule extends BaseNeuronModule {
  readonly name = 'security' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = [];
  readonly packageName = '@neuron-ai-memory/security';
  readonly capabilities = caps(
    ['security.redact', 'Redact secrets'],
    ['security.privacy', 'Privacy consent defaults'],
  );
}

export class PerformanceModule extends BaseNeuronModule {
  readonly name = 'performance' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['memory', 'graph'];
  readonly packageName = '@neuron-ai-memory/performance-intelligence';
  readonly capabilities = caps(['performance.review', 'Performance heuristics']);
}

export class DocumentationModule extends BaseNeuronModule {
  readonly name = 'documentation' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['memory', 'graph'];
  readonly packageName = '@neuron-ai-memory/documentation-intelligence';
  readonly capabilities = caps(['docs.generate', 'Living documentation']);
}

export class EvaluationModule extends BaseNeuronModule {
  readonly name = 'evaluation' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['memory', 'retrieval', 'decision'];
  readonly packageName = '@neuron-ai-memory/evaluation-engine';
  readonly capabilities = caps(
    ['evaluation.score', 'Answer quality scoring'],
    ['evaluation.benchmark', 'Quality benchmarks'],
  );
}

export class WorkflowModule extends BaseNeuronModule {
  readonly name = 'workflow' as const;
  readonly version = '0.1.0';
  readonly dependencies: ModuleName[] = ['memory'];
  readonly packageName = '@neuron-ai-memory/workflow-intelligence';
  readonly capabilities = caps(['workflow.resume', 'Technical session resume/handoff']);
}

/** Factory for the closed set of Neuron core modules — no dynamic plugins. */
export function createCoreModules(): BaseNeuronModule[] {
  return [
    new SecurityModule(),
    new MemoryModule(),
    new GraphModule(),
    new RetrievalModule(),
    new DecisionModule(),
    new AIProviderModule(),
    new PerformanceModule(),
    new DocumentationModule(),
    new EvaluationModule(),
    new WorkflowModule(),
  ];
}

export const CORE_MODULE_NAMES: ModuleName[] = [
  'memory',
  'graph',
  'retrieval',
  'decision',
  'ai-provider',
  'security',
  'performance',
  'documentation',
  'evaluation',
  'workflow',
];
