import { describe, expect, it } from 'vitest';

import { SDK_VERSION } from '../src/index.js';

describe('sdk', () => {
  it('exposes a version string', () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
