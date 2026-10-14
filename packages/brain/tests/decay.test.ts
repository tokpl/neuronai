import { describe, expect, it } from 'vitest';

import { extractReferencedPaths } from '../src/decay.js';

describe('extractReferencedPaths', () => {
  it('finds relative source paths', () => {
    const paths = extractReferencedPaths('See `src/auth/middleware.ts` and packages/foo/bar.ts');
    expect(paths).toContain('src/auth/middleware.ts');
    expect(paths).toContain('packages/foo/bar.ts');
  });
});
