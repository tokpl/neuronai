import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/index.js';

describe('createLogger', () => {
  it('creates a named logger', () => {
    const logger = createLogger({ name: 'test', level: 'error' });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('accepts stderr destination for MCP stdio safety', () => {
    const logger = createLogger({ name: 'mcp-test', level: 'info', destination: 'stderr' });
    expect(logger).toBeDefined();
    logger.info({ probe: true }, 'stdio-safe');
  });
});
