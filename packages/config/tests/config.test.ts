import { describe, expect, it } from 'vitest';

import { defaultNeuronConfig, validateConfig } from '../src/index.js';

describe('validateConfig', () => {
  it('accepts the default config shape', () => {
    const config = validateConfig(defaultNeuronConfig);
    expect(config.memory.autoSave).toBe(true);
    expect(config.project.type).toBe('application');
  });

  it('rejects invalid importance threshold', () => {
    expect(() =>
      validateConfig({
        ...defaultNeuronConfig,
        memory: { ...defaultNeuronConfig.memory, importanceThreshold: 2 },
      }),
    ).toThrow(/Invalid Neuron configuration/);
  });

  it('exposes no cloud, provider or database configuration', () => {
    const config = validateConfig(defaultNeuronConfig) as Record<string, unknown>;
    for (const key of ['server', 'providers', 'security', 'database']) {
      expect(config[key], `config must not expose "${key}"`).toBeUndefined();
    }
  });

  it('ignores unknown keys left over from older configs', () => {
    const config = validateConfig({
      ...defaultNeuronConfig,
      server: { mode: 'cloud' },
      providers: { llm: { provider: 'openai', model: 'gpt-4' } },
    }) as Record<string, unknown>;

    expect(config['server']).toBeUndefined();
    expect(config['providers']).toBeUndefined();
  });
});
