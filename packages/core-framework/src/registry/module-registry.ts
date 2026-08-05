import type { NeuronModule } from '../interfaces/neuron-module.js';
import type { ModuleManifest, ModuleName } from '../types.js';
import { NeuronError } from '../errors/neuron-error.js';

/**
 * Closed registry of Neuron-owned modules.
 * Rejects unknown / third-party module names.
 */
export class ModuleRegistry {
  private readonly modules = new Map<ModuleName, NeuronModule>();
  private readonly allowed: ReadonlySet<ModuleName>;

  constructor(allowedNames: ModuleName[]) {
    this.allowed = new Set(allowedNames);
  }

  register(module: NeuronModule): void {
    if (!this.allowed.has(module.name)) {
      throw new NeuronError({
        category: 'module',
        severity: 'critical',
        module: 'core',
        message: `Refused to register unknown module "${module.name}"`,
        solutionHint:
          'Only Neuron core modules may be registered. There is no plugin marketplace.',
      });
    }
    if (this.modules.has(module.name)) {
      throw new NeuronError({
        category: 'module',
        severity: 'high',
        module: module.name,
        message: `Module already registered: ${module.name}`,
        solutionHint: 'Register each core module once during bootstrap.',
      });
    }
    this.modules.set(module.name, module);
  }

  get(name: ModuleName): NeuronModule | undefined {
    return this.modules.get(name);
  }

  require(name: ModuleName): NeuronModule {
    const m = this.modules.get(name);
    if (!m) {
      throw new NeuronError({
        category: 'module',
        severity: 'high',
        module: name,
        message: `Module not registered: ${name}`,
        solutionHint: 'Ensure createCoreModules() ran during bootstrap.',
      });
    }
    return m;
  }

  list(): NeuronModule[] {
    return [...this.modules.values()];
  }

  manifests(): ModuleManifest[] {
    return this.list().map((m) => ({
      name: m.name,
      version: m.version,
      dependencies: [...m.dependencies],
      capabilities: [...m.capabilities],
      packageName: m.packageName,
    }));
  }

  /**
   * Topological order for initialize — dependencies first.
   */
  resolveOrder(): ModuleName[] {
    const names = this.list().map((m) => m.name);
    const visiting = new Set<ModuleName>();
    const done = new Set<ModuleName>();
    const order: ModuleName[] = [];

    const visit = (name: ModuleName) => {
      if (done.has(name)) return;
      if (visiting.has(name)) {
        throw new NeuronError({
          category: 'module',
          severity: 'critical',
          module: name,
          message: `Circular dependency involving ${name}`,
          solutionHint: 'Fix core module dependency graph.',
        });
      }
      visiting.add(name);
      const mod = this.require(name);
      for (const dep of mod.dependencies) {
        if (!this.modules.has(dep)) {
          throw new NeuronError({
            category: 'module',
            severity: 'high',
            module: name,
            message: `Missing dependency ${dep} required by ${name}`,
            solutionHint: 'Register dependency modules before dependents.',
          });
        }
        visit(dep);
      }
      visiting.delete(name);
      done.add(name);
      order.push(name);
    };

    for (const n of names) visit(n);
    return order;
  }
}

export function createModuleRegistry(allowed: ModuleName[]): ModuleRegistry {
  return new ModuleRegistry(allowed);
}
