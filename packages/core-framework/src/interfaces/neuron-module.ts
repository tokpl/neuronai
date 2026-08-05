import type { ModuleCapability, ModuleHealth, ModuleManifest, ModuleName, ModuleState } from '../types.js';
import { nowIso } from '../types.js';

export interface NeuronModuleContext {
  neuronDir: string;
  getService: <T>(token: string) => T | undefined;
  emit: (type: string, payload: unknown) => void;
}

/**
 * Internal module contract.
 * Only Neuron-owned modules implement this — no third-party plugins.
 */
export interface NeuronModule {
  readonly name: ModuleName;
  readonly version: string;
  readonly dependencies: ModuleName[];
  readonly capabilities: ModuleCapability[];
  readonly packageName: string;

  initialize(ctx: NeuronModuleContext): Promise<void> | void;
  shutdown(): Promise<void> | void;
  healthCheck(): Promise<ModuleHealth> | ModuleHealth;
}

export abstract class BaseNeuronModule implements NeuronModule {
  abstract readonly name: ModuleName;
  abstract readonly version: string;
  abstract readonly dependencies: ModuleName[];
  abstract readonly capabilities: ModuleCapability[];
  abstract readonly packageName: string;

  protected state: ModuleState = 'registered';
  protected ctx: NeuronModuleContext | null = null;

  async initialize(ctx: NeuronModuleContext): Promise<void> {
    this.ctx = ctx;
    this.state = 'initialized';
  }

  async shutdown(): Promise<void> {
    this.state = 'stopped';
    this.ctx = null;
  }

  healthCheck(): ModuleHealth {
    return {
      name: this.name,
      ok: this.state === 'initialized' || this.state === 'running' || this.state === 'loaded',
      state: this.state,
      detail: `module ${this.name}@${this.version}`,
      checkedAt: nowIso(),
    };
  }

  markRunning(): void {
    this.state = 'running';
  }

  markFailed(detail: string): ModuleHealth {
    this.state = 'failed';
    return {
      name: this.name,
      ok: false,
      state: this.state,
      detail,
      checkedAt: nowIso(),
    };
  }

  toManifest(): ModuleManifest {
    return {
      name: this.name,
      version: this.version,
      dependencies: [...this.dependencies],
      capabilities: [...this.capabilities],
      packageName: this.packageName,
    };
  }
}
