import type { NeuronModuleContext } from '../interfaces/neuron-module.js';
import type { ModuleName, ModuleState } from '../types.js';
import { NeuronError } from '../errors/neuron-error.js';
import type { NeuronEventBus } from '../events/event-bus.js';
import type { NeuronContainer } from '../registry/container.js';
import type { ModuleRegistry } from '../registry/module-registry.js';

export type LifecyclePhase = 'load' | 'initialize' | 'validate' | 'run' | 'shutdown';

/**
 * ModuleLifecycleManager — load → initialize → validate → run → shutdown.
 */
export class ModuleLifecycleManager {
  private phase: LifecyclePhase | 'idle' = 'idle';
  private readonly states = new Map<ModuleName, ModuleState>();

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly container: NeuronContainer,
    private readonly bus: NeuronEventBus,
    private readonly neuronDir: string,
  ) {}

  getPhase(): LifecyclePhase | 'idle' {
    return this.phase;
  }

  getState(name: ModuleName): ModuleState | undefined {
    return this.states.get(name);
  }

  async load(): Promise<void> {
    this.phase = 'load';
    for (const m of this.registry.list()) {
      this.states.set(m.name, 'loaded');
    }
  }

  async initialize(): Promise<void> {
    this.phase = 'initialize';
    const order = this.registry.resolveOrder();
    const ctx: NeuronModuleContext = {
      neuronDir: this.neuronDir,
      getService: <T>(token: string) => this.container.get<T>(token),
      emit: (type, payload) => {
        void this.bus.emit(type as never, payload);
      },
    };
    for (const name of order) {
      const mod = this.registry.require(name);
      try {
        await mod.initialize(ctx);
        this.states.set(name, 'initialized');
      } catch (err) {
        this.states.set(name, 'failed');
        throw new NeuronError({
          category: 'module',
          severity: 'critical',
          module: name,
          message: `Failed to initialize ${name}`,
          solutionHint: 'Check module dependencies and configuration.',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async validate(): Promise<void> {
    this.phase = 'validate';
    for (const m of this.registry.list()) {
      for (const dep of m.dependencies) {
        const state = this.states.get(dep);
        if (state !== 'initialized' && state !== 'running') {
          throw new NeuronError({
            category: 'module',
            severity: 'high',
            module: m.name,
            message: `Dependency ${dep} not ready for ${m.name}`,
            solutionHint: 'Initialize modules in dependency order.',
          });
        }
      }
      // Compatibility: dependents expect same major as declared version of deps
      for (const dep of m.dependencies) {
        const depMod = this.registry.require(dep);
        if (!depMod.version.startsWith(m.version.split('.')[0] + '.') && m.version !== depMod.version) {
          // soft check — majors should match across core 0.x
          if (depMod.version.split('.')[0] !== m.version.split('.')[0]) {
            throw new NeuronError({
              category: 'module',
              severity: 'high',
              module: m.name,
              message: `Incompatible versions: ${m.name}@${m.version} vs ${dep}@${depMod.version}`,
              solutionHint: 'Align core module semantic versions (same major).',
            });
          }
        }
      }
    }
  }

  async run(): Promise<void> {
    this.phase = 'run';
    for (const m of this.registry.list()) {
      if ('markRunning' in m && typeof (m as { markRunning?: () => void }).markRunning === 'function') {
        (m as { markRunning: () => void }).markRunning();
      }
      this.states.set(m.name, 'running');
    }
  }

  async shutdown(): Promise<void> {
    this.phase = 'shutdown';
    const order = [...this.registry.resolveOrder()].reverse();
    for (const name of order) {
      const mod = this.registry.require(name);
      await mod.shutdown();
      this.states.set(name, 'stopped');
    }
    this.phase = 'idle';
  }

  async boot(): Promise<void> {
    await this.load();
    await this.initialize();
    await this.validate();
    await this.run();
  }
}

export function createModuleLifecycleManager(
  registry: ModuleRegistry,
  container: NeuronContainer,
  bus: NeuronEventBus,
  neuronDir: string,
): ModuleLifecycleManager {
  return new ModuleLifecycleManager(registry, container, bus, neuronDir);
}
