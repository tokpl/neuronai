import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/index.js';

describe('createLogger', () => {
  it('creates a named logger', () => {
    const logger = createLogger({ name: 'test', level: 'error' });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });
});
