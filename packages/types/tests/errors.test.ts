import { describe, expect, it } from 'vitest';

import { MemoryError, NeuronError, NotImplementedError } from '../src/index.js';

describe('NeuronError hierarchy', () => {
  it('sets default code on NeuronError', () => {
    const err = new NeuronError('boom');
    expect(err.code).toBe('NEURON_ERROR');
    expect(err.message).toBe('boom');
  });

  it('uses MEMORY_ERROR for MemoryError', () => {
    const err = new MemoryError('bad memory', { id: '1' });
    expect(err.code).toBe('MEMORY_ERROR');
    expect(err.details).toEqual({ id: '1' });
  });

  it('marks NotImplementedError clearly', () => {
    const err = new NotImplementedError('embeddings');
    expect(err.code).toBe('NOT_IMPLEMENTED');
    expect(err.message).toContain('embeddings');
  });
});
