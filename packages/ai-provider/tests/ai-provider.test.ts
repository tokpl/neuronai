import { describe, expect, it } from 'vitest';

import { MockAIProvider, heuristicClassify, heuristicExtract } from '../src/index.js';

describe('MockAIProvider', () => {
  it('extracts architecture decisions heuristically', async () => {
    const ai = new MockAIProvider();
    const text =
      'We moved auth into a separate module because we want to scale login independently.';
    expect(heuristicClassify(text)).toBe('ARCHITECTURE_DECISION');
    const extracted = heuristicExtract(text);
    expect(extracted[0]?.type).toBe('ARCHITECTURE_DECISION');
    expect(extracted[0]?.confidence).toBeGreaterThan(0.8);

    const classified = JSON.parse(await ai.classify(text)) as { type: string };
    expect(classified.type).toBe('ARCHITECTURE_DECISION');
  });

  it('ignores tiny temporary chatter', () => {
    expect(heuristicClassify('just checking tmp debug')).toBe('IGNORE');
  });
});
