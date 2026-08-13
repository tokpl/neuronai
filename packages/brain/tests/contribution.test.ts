import { describe, expect, it } from 'vitest';

import {
  buildContextContribution,
  CONTRIBUTION_EMOJI,
  formatContributionTokens,
  type ContextEfficiency,
} from '../src/index.js';

const baseEfficiency = (over: Partial<ContextEfficiency> = {}): ContextEfficiency => ({
  contextTokens: 358,
  budgetTokens: 1200,
  corpusTokens: 1172,
  itemsSelected: 12,
  itemsDiscarded: 10,
  compressionRatio: 3.27,
  estimatedTokensSaved: 814,
  baseline: 'matched-knowledge-verbatim',
  retrievalMs: 26,
  estimatedRediscoveryAvoided: 0,
  rediscoveryBaseline: 'simulated-structural-exploration',
  ...over,
});

describe('buildContextContribution', () => {
  it('explains tokens, memories, paths, size, and ranking time in plain language', () => {
    const contribution = buildContextContribution({
      efficiency: baseEfficiency(),
      memoriesUsed: 12,
      memoriesSkipped: 10,
      memoriesInBrain: 22,
      relevantFiles: [
        {
          name: 'context.ts',
          path: 'packages/brain/src/context.ts',
          kind: 'file',
          why: 'prepares context',
        },
      ],
      relevantModules: [
        {
          name: 'brain',
          path: 'packages/brain',
          kind: 'module',
          why: 'owns retrieval',
        },
      ],
      relevantRules: [{ title: 'One brain', detail: 'ProjectBrain is the source of truth' }],
      recommendationPath: 'packages/brain/src/context.ts',
    });

    expect(contribution.label).toBe('brain-compression');
    expect(contribution.brainCompressionTokens).toBe(814);
    expect(contribution.memoriesUsed).toBe(12);
    expect(contribution.pathsSuggested).toBe(2);
    expect(contribution.rulesApplied).toBe(1);
    expect(contribution.summary.startsWith(CONTRIBUTION_EMOJI)).toBe(true);
    expect(contribution.summary).toMatch(/saved ~814 tokens of context/);
    expect(contribution.summary).not.toMatch(/dumping/i);
    expect(contribution.summary).toMatch(/Used 12 memories from Project Brain/);
    expect(contribution.summary).not.toMatch(/skipped/i);
    expect(contribution.summary).toMatch(/Pointed the agent to 2 file\/module paths and 1 project rule/);
    expect(contribution.summary).toMatch(
      /Context is ~3\.3× more compact than matched Project Brain knowledge/,
    );
    expect(contribution.summary).toMatch(/Ranked this context in 26 ms/);
    expect(contribution.lines.some((l) => l.startsWith('Best start:'))).toBe(true);
  });

  it('still emits a clear summary when savings and paths are zero', () => {
    const contribution = buildContextContribution({
      efficiency: baseEfficiency({
        estimatedTokensSaved: 0,
        estimatedRediscoveryAvoided: 0,
        itemsSelected: 2,
        itemsDiscarded: 0,
        compressionRatio: 1,
      }),
      relevantFiles: [],
      relevantModules: [],
      relevantRules: [],
    });
    expect(contribution.summary).toMatch(/saved ~0 tokens of context/);
    expect(contribution.summary).toMatch(/Used 2 memories from Project Brain/);
    expect(contribution.summary).toMatch(/Ranked this context in \d+ ms/);
    expect(contribution.summary).not.toMatch(/dumping/i);
    expect(contribution.summary).not.toMatch(/skipped/i);
  });

  it('includes simulated rediscovery with a plain gloss when estimate is positive', () => {
    const contribution = buildContextContribution({
      efficiency: baseEfficiency({ estimatedRediscoveryAvoided: 480 }),
      relevantFiles: [],
      relevantModules: [],
      relevantRules: [],
    });
    expect(contribution.rediscoveryTokensSimulated).toBe(480);
    expect(contribution.summary).toMatch(
      /~480 fewer tokens of structural rediscovery \(simulated\)/,
    );
  });
});

describe('formatContributionTokens', () => {
  it('formats thousands compactly', () => {
    expect(formatContributionTokens(800)).toBe('800');
    expect(formatContributionTokens(1180)).toBe('1.2k');
  });
});
