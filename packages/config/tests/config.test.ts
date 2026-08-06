import { describe, expect, it } from 'vitest';

import { defaultNeuronConfig, validateConfig } from '../src/index.js';

describe('validateConfig', () => {
  it('accepts the default config shape', () => {
    const config = validateConfig(defaultNeuronConfig);
    expect(config.memory.autoSave).toBe(true);
    expect(config.server.mode).toBe('local');
  });

  it('rejects invalid importance threshold', () => {
    expect(() =>
      validateConfig({
        ...defaultNeuronConfig,
        memory: { ...defaultNeuronConfig.memory, importanceThreshold: 2 },
      }),
    ).toThrow(/Invalid Neuron configuration/);
  });
});
