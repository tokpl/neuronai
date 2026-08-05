import { describe, expect, it } from 'vitest';

import { jaccardLike } from '../src/similarity.js';

/**
 * Light synthetic bench — not a full 10k/100k/1M suite.
 * Use for CI smoke; extend with fixtures for real perf runs.
 */
describe('search similarity smoke bench', () => {
  it('scores many text pairs under a soft budget', () => {
    const left =
      'decision postgres pgvector hybrid search memory engine architecture patterns conventions';
    const right =
      'decision use postgres with pgvector for hybrid memory search and ranking patterns';
    const start = performance.now();
    let last = 0;
    for (let i = 0; i < 5_000; i++) {
      last = jaccardLike(`${left} ${i % 7}`, right);
    }
    const ms = performance.now() - start;
    expect(last).toBeGreaterThan(0);
    expect(ms).toBeLessThan(5_000);
  });
});
