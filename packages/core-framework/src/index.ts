export type {
  ModuleName,
  ModuleState,
  NeuronEventType,
  ErrorCategory,
  ErrorSeverity,
  ModuleCapability,
  ModuleManifest,
  ModuleHealth,
  NeuronEvent,
  NeuronErrorShape,
  MigrationStep,
  MigrationContext,
  ConfigLayer,
  ResolvedNeuronConfig,
} from './types.js';
export { nowIso, newId, compareSemver, isCompatible } from './types.js';

export {
  type NeuronModule,
  type NeuronModuleContext,
  BaseNeuronModule,
} from './interfaces/neuron-module.js';

export {
  MemoryModule,
  GraphModule,
  RetrievalModule,
  DecisionModule,
  AIProviderModule,
  SecurityModule,
  PerformanceModule,
  DocumentationModule,
  EvaluationModule,
  WorkflowModule,
  createCoreModules,
  CORE_MODULE_NAMES,
} from './modules/core-modules.js';

export { NeuronEventBus, createNeuronEventBus, type EventHandler } from './events/event-bus.js';
export { ModuleRegistry, createModuleRegistry } from './registry/module-registry.js';
export {
  NeuronContainer,
  createNeuronContainer,
  ServiceTokens,
} from './registry/container.js';
export {
  ModuleLifecycleManager,
  createModuleLifecycleManager,
  type LifecyclePhase,
} from './lifecycle/lifecycle-manager.js';
export {
  NeuronMigrationEngine,
  createNeuronMigrationEngine,
} from './lifecycle/migration-engine.js';
export {
  NeuronHealthManager,
  createNeuronHealthManager,
  type SystemHealthReport,
} from './lifecycle/health-manager.js';
export { NeuronConfig, createNeuronConfig } from './configuration/neuron-config.js';
export {
  NeuronError,
  NeuronErrorSystem,
  createNeuronErrorSystem,
} from './errors/neuron-error.js';
export { createNeuronCoreApi, type NeuronCoreApi } from './api/core-api.js';
export {
  CoreFramework,
  createCoreFramework,
  type CoreFrameworkOptions,
} from './facade/core-framework.js';
