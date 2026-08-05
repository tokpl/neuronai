import type { ModuleHealth, ModuleName } from '../types.js';
import { nowIso } from '../types.js';
import type { ModuleRegistry } from '../registry/module-registry.js';
import type { NeuronContainer } from '../registry/container.js';

export interface SystemHealthReport {
  ok: boolean;
  checkedAt: string;
  modules: ModuleHealth[];
  storage: { ok: boolean; detail: string };
  aiProviders: { ok: boolean; detail: string };
  index: { ok: boolean; detail: string };
}

/**
 * NeuronHealthManager — module / storage / providers / index status.
 */
export class NeuronHealthManager {
  constructor(
    private readonly registry: ModuleRegistry,
    private readonly container: NeuronContainer,
  ) {}

  async check(input?: {
    storageOk?: boolean;
    storageDetail?: string;
    providersOk?: boolean;
    providersDetail?: string;
    indexOk?: boolean;
    indexDetail?: string;
  }): Promise<SystemHealthReport> {
    const modules: ModuleHealth[] = [];
    for (const m of this.registry.list()) {
      modules.push(await m.healthCheck());
    }
    const storage = {
      ok: input?.storageOk !== false,
      detail: input?.storageDetail ?? 'Local .neuron/ storage assumed healthy',
    };
    const aiProviders = {
      ok: input?.providersOk !== false,
      detail: input?.providersDetail ?? 'Offline / configured providers (see ai-runtime)',
    };
    const index = {
      ok: input?.indexOk !== false,
      detail: input?.indexDetail ?? 'Memory index present or lazy',
    };
    const ok =
      modules.every((m) => m.ok) && storage.ok && aiProviders.ok && index.ok;
    return {
      ok,
      checkedAt: nowIso(),
      modules,
      storage,
      aiProviders,
      index,
    };
  }

  moduleStatus(name: ModuleName): ModuleHealth | undefined {
    const m = this.registry.get(name);
    return m?.healthCheck() as ModuleHealth | undefined;
  }
}

export function createNeuronHealthManager(
  registry: ModuleRegistry,
  container: NeuronContainer,
): NeuronHealthManager {
  return new NeuronHealthManager(registry, container);
}
