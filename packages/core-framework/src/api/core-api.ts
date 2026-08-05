import type { NeuronEventBus } from '../events/event-bus.js';
import type { NeuronConfig } from '../configuration/neuron-config.js';
import type { ModuleRegistry } from '../registry/module-registry.js';
import type { NeuronContainer } from '../registry/container.js';
import type { ModuleLifecycleManager } from '../lifecycle/lifecycle-manager.js';
import type { NeuronHealthManager } from '../lifecycle/health-manager.js';
import type { NeuronMigrationEngine } from '../lifecycle/migration-engine.js';
import type { ModuleManifest, ModuleName, NeuronEventType } from '../types.js';

/**
 * Internal Core API for Neuron-owned modules only.
 * Not published as a third-party SDK / plugin API.
 */
export interface NeuronCoreApi {
  readonly version: string;
  getModule(name: ModuleName): ModuleManifest | undefined;
  listModules(): ModuleManifest[];
  getConfig<T = unknown>(key: string, fallback?: T): T;
  emit(type: NeuronEventType, payload: unknown, module?: ModuleName | 'core'): Promise<void>;
  getService<T>(token: string): T | undefined;
  health(): ReturnType<NeuronHealthManager['check']>;
}

export function createNeuronCoreApi(deps: {
  registry: ModuleRegistry;
  config: NeuronConfig;
  bus: NeuronEventBus;
  container: NeuronContainer;
  health: NeuronHealthManager;
  lifecycle: ModuleLifecycleManager;
  migrations: NeuronMigrationEngine;
}): NeuronCoreApi {
  return {
    version: '0.1.0',
    getModule(name) {
      return deps.registry.manifests().find((m) => m.name === name);
    },
    listModules() {
      return deps.registry.manifests();
    },
    getConfig(key, fallback) {
      return deps.config.get(key, fallback);
    },
    async emit(type, payload, module = 'core') {
      await deps.bus.emit(type, payload, module);
    },
    getService(token) {
      return deps.container.get(token);
    },
    health() {
      return deps.health.check();
    },
  };
}
