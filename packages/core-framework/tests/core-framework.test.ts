import { describe, expect, it } from 'vitest';

import {
  CORE_MODULE_NAMES,
  createCoreFramework,
  createCoreModules,
  createModuleRegistry,
  createNeuronConfig,
  createNeuronEventBus,
  createNeuronMigrationEngine,
  MemoryModule,
  NeuronError,
} from '../src/index.js';

describe('module loading', () => {
  it('registers all core modules and boots lifecycle', async () => {
    const fw = createCoreFramework({ neuronDir: '.neuron' });
    const api = await fw.boot();
    expect(fw.isBooted()).toBe(true);
    expect(api.listModules()).toHaveLength(CORE_MODULE_NAMES.length);
    expect(api.getModule('memory')?.packageName).toContain('memory-engine');
    const health = await api.health();
    expect(health.ok).toBe(true);
    expect(health.modules.every((m) => m.ok)).toBe(true);
    await fw.shutdown();
    expect(fw.isBooted()).toBe(false);
  });

  it('rejects third-party module registration', () => {
    const registry = createModuleRegistry(CORE_MODULE_NAMES);
    expect(() =>
      registry.register({
        name: 'hacker' as never,
        version: '1.0.0',
        dependencies: [],
        capabilities: [],
        packageName: 'evil',
        initialize: () => undefined,
        shutdown: () => undefined,
        healthCheck: () => ({
          name: 'memory',
          ok: true,
          state: 'registered',
          detail: '',
          checkedAt: '',
        }),
      }),
    ).toThrow(NeuronError);
  });
});

describe('dependencies', () => {
  it('resolves topological order with security before ai-provider', () => {
    const registry = createModuleRegistry(CORE_MODULE_NAMES);
    for (const m of createCoreModules()) registry.register(m);
    const order = registry.resolveOrder();
    expect(order.indexOf('security')).toBeLessThan(order.indexOf('ai-provider'));
    expect(order.indexOf('memory')).toBeLessThan(order.indexOf('graph'));
    expect(order.indexOf('graph')).toBeLessThan(order.indexOf('retrieval'));
    expect(order.indexOf('retrieval')).toBeLessThan(order.indexOf('evaluation'));
  });

  it('dependencyFlow lists edges', async () => {
    const fw = createCoreFramework();
    await fw.boot();
    const flow = fw.dependencyFlow();
    expect(flow.some((l) => l.includes('retrieval') && l.includes('memory'))).toBe(true);
    await fw.shutdown();
  });
});

describe('migrations', () => {
  it('applies config/memory/graph baseline migrations', async () => {
    const eng = createNeuronMigrationEngine();
    const result = await eng.migrate({
      neuronDir: '/tmp/neuron',
      fromVersion: '0.0.0',
      toVersion: '0.1.0',
    });
    expect(result.applied).toContain('config-v1-privacy');
    expect(result.applied).toContain('memory-schema-v1');
    expect(result.applied).toContain('graph-schema-v1');
  });

  it('dry-run does not fail', async () => {
    const eng = createNeuronMigrationEngine();
    const result = await eng.migrate({
      neuronDir: '/tmp/neuron',
      fromVersion: '0.0.0',
      toVersion: '0.1.0',
      dryRun: true,
    });
    expect(result.log[0]).toMatch(/dry-run/);
  });
});

describe('health + config + events', () => {
  it('config priority project > env > default', () => {
    const cfg = createNeuronConfig();
    cfg.setDefaults({ mode: 'local', allowCloud: false });
    cfg.setEnv({ allowCloud: true });
    cfg.setProject({ allowCloud: false, mode: 'hybrid' });
    const resolved = cfg.resolve();
    expect(resolved.values['mode']).toBe('hybrid');
    expect(resolved.values['allowCloud']).toBe(false);
    expect(resolved.priority[0]).toBe('project');
  });

  it('event bus delivers MemoryCreated', async () => {
    const bus = createNeuronEventBus();
    const seen: string[] = [];
    bus.on('MemoryCreated', (e) => {
      seen.push(String((e.payload as { id: string }).id));
    });
    await bus.emit('MemoryCreated', { id: 'm1' }, 'memory');
    expect(seen).toEqual(['m1']);
  });

  it('health reports modules', async () => {
    const fw = createCoreFramework();
    await fw.boot();
    const report = await fw.getHealth().check({ storageOk: true, providersOk: true });
    expect(report.modules).toHaveLength(10);
    expect(report.storage.ok).toBe(true);
    await fw.shutdown();
  });

  it('MemoryModule manifest is stable', () => {
    const m = new MemoryModule();
    expect(m.toManifest().name).toBe('memory');
    expect(m.capabilities.length).toBeGreaterThan(0);
  });
});
