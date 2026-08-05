/**
 * Lightweight service container for internal Neuron services.
 * Not a public DI framework for third parties.
 */
export class NeuronContainer {
  private readonly services = new Map<string, unknown>();
  private readonly providers = new Map<string, () => unknown>();

  register<T>(token: string, instance: T): void {
    this.services.set(token, instance);
  }

  registerProvider<T>(token: string, factory: () => T): void {
    this.providers.set(token, factory);
  }

  get<T>(token: string): T | undefined {
    if (this.services.has(token)) return this.services.get(token) as T;
    const factory = this.providers.get(token);
    if (!factory) return undefined;
    const instance = factory() as T;
    this.services.set(token, instance);
    return instance;
  }

  require<T>(token: string): T {
    const v = this.get<T>(token);
    if (v === undefined) {
      throw new Error(`Service not found: ${token}`);
    }
    return v;
  }

  has(token: string): boolean {
    return this.services.has(token) || this.providers.has(token);
  }

  tokens(): string[] {
    return [...new Set([...this.services.keys(), ...this.providers.keys()])];
  }

  clear(): void {
    this.services.clear();
    this.providers.clear();
  }
}

export function createNeuronContainer(): NeuronContainer {
  return new NeuronContainer();
}

/** Well-known internal service tokens */
export const ServiceTokens = {
  EventBus: 'neuron.eventBus',
  Config: 'neuron.config',
  Registry: 'neuron.registry',
  Health: 'neuron.health',
  Migrations: 'neuron.migrations',
} as const;
