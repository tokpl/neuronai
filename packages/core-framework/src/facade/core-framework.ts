import { createNeuronConfig } from '../configuration/neuron-config.js';
import { createNeuronEventBus } from '../events/event-bus.js';
import { createNeuronErrorSystem } from '../errors/neuron-error.js';
import { createNeuronCoreApi, type NeuronCoreApi } from '../api/core-api.js';
import { createModuleLifecycleManager } from '../lifecycle/lifecycle-manager.js';
import { createNeuronHealthManager } from '../lifecycle/health-manager.js';
import { createNeuronMigrationEngine } from '../lifecycle/migration-engine.js';
import { CORE_MODULE_NAMES, createCoreModules } from '../modules/core-modules.js';
import { createNeuronContainer, ServiceTokens } from '../registry/container.js';
import { createModuleRegistry } from '../registry/module-registry.js';
import type { NeuronEventType } from '../types.js';
import { NeuronError } from '../errors/neuron-error.js';

export interface CoreFrameworkOptions {
  neuronDir?: string;
  projectConfig?: Record<string, unknown>;
  /** Reject any attempt to register non-core modules (always true) */
  allowThirdPartyModules?: false;
}

/**
 * Core Framework bootstrap — controlled internal module system.
 * No marketplace, no dynamic unsafe loading, no user plugins.
 */
export class CoreFramework {
  private readonly bus = createNeuronEventBus();
  private readonly container = createNeuronContainer();
  private readonly config = createNeuronConfig();
  private readonly errors = createNeuronErrorSystem();
  private readonly migrations = createNeuronMigrationEngine();
  private readonly registry = createModuleRegistry(CORE_MODULE_NAMES);
  private readonly lifecycle: ReturnType<typeof createModuleLifecycleManager>;
  private readonly health: ReturnType<typeof createNeuronHealthManager>;
  private api: NeuronCoreApi;
  private booted = false;

  constructor(private readonly options: CoreFrameworkOptions = {}) {
    if (options.allowThirdPartyModules) {
      throw new NeuronError({
        category: 'module',
        severity: 'critical',
        module: 'core',
        message: 'Third-party modules are not supported',
        solutionHint: 'Neuron is a controlled system — no plugin marketplace.',
      });
    }

    this.config.loadFromProcessEnv();
    if (options.projectConfig) this.config.setProject(options.projectConfig);

    for (const mod of createCoreModules()) {
      this.registry.register(mod);
    }

    this.lifecycle = createModuleLifecycleManager(
      this.registry,
      this.container,
      this.bus,
      options.neuronDir ?? '.neuron',
    );
    this.health = createNeuronHealthManager(this.registry, this.container);

    this.container.register(ServiceTokens.EventBus, this.bus);
    this.container.register(ServiceTokens.Config, this.config);
    this.container.register(ServiceTokens.Registry, this.registry);
    this.container.register(ServiceTokens.Health, this.health);
    this.container.register(ServiceTokens.Migrations, this.migrations);

    this.api = createNeuronCoreApi({
      registry: this.registry,
      config: this.config,
      bus: this.bus,
      container: this.container,
      health: this.health,
      lifecycle: this.lifecycle,
      migrations: this.migrations,
    });
  }

  async boot(): Promise<NeuronCoreApi> {
    await this.lifecycle.boot();
    this.booted = true;
    return this.api;
  }

  async shutdown(): Promise<void> {
    await this.lifecycle.shutdown();
    this.bus.clear();
    this.booted = false;
  }

  getApi(): NeuronCoreApi {
    return this.api;
  }

  isBooted(): boolean {
    return this.booted;
  }

  getRegistry() {
    return this.registry;
  }

  getContainer() {
    return this.container;
  }

  getConfig() {
    return this.config;
  }

  getEventBus() {
    return this.bus;
  }

  getLifecycle() {
    return this.lifecycle;
  }

  getMigrations() {
    return this.migrations;
  }

  getHealth() {
    return this.health;
  }

  getErrors() {
    return this.errors;
  }

  async emit(type: NeuronEventType, payload: unknown) {
    return this.bus.emit(type, payload);
  }

  dependencyFlow(): string[] {
    return this.registry.resolveOrder().map((name) => {
      const m = this.registry.require(name);
      const deps = m.dependencies.length ? ` ← [${m.dependencies.join(', ')}]` : '';
      return `${name}@${m.version}${deps}`;
    });
  }
}

export function createCoreFramework(options?: CoreFrameworkOptions): CoreFramework {
  return new CoreFramework(options);
}
