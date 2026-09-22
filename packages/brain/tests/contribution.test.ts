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

  it('handles fallback logic for memory counts when not provided', () => {
    const contribution = buildContextContribution({
      efficiency: baseEfficiency({
        itemsSelected: 5,
        itemsDiscarded: 3,
      }),
      relevantFiles: [],
      relevantModules: [],
      relevantRules: [{ title: 'Test Rule', detail: 'testing' }],
    });
    // memoriesUsed = max(0, 5 - 1 rule) = 4
    expect(contribution.memoriesUsed).toBe(4);
    // memoriesSkipped = max(0, 3) = 3
    expect(contribution.memoriesSkipped).toBe(3);
    // memoriesInBrain = max(0, 4 + 1 + 3) = 8
    expect(contribution.memoriesInBrain).toBe(8);
  });

  it('handles non-finite and negative compression ratios correctly', () => {
    const contributionInfinite = buildContextContribution({
      efficiency: baseEfficiency({ compressionRatio: Infinity }),
      relevantFiles: [],
      relevantModules: [],
      relevantRules: [],
    });
    // For infinity, compressionRatio is Infinity, which is >= 1.2, so formatRatio is called.
    // formatRatio returns '1×' for Infinity.
    expect(contributionInfinite.lines.join('\n')).toMatch(/1×/);
    expect(contributionInfinite.compressionRatio).toBe(Infinity);

    const contributionNegative = buildContextContribution({
      efficiency: baseEfficiency({ compressionRatio: -5 }),
      relevantFiles: [],
      relevantModules: [],
      relevantRules: [],
    });
    // In buildContextContribution, negative compression ratio defaults to 1.
    // 1 < 1.2, so it falls into the else branch 'Packed into...'
    expect(contributionNegative.lines.join('\n')).toMatch(/Packed into/);
    expect(contributionNegative.compressionRatio).toBe(1);
  });
});

describe('formatContributionTokens', () => {
  it('formats numbers less than 1000 exactly', () => {
    expect(formatContributionTokens(0)).toBe('0');
    expect(formatContributionTokens(800)).toBe('800');
    expect(formatContributionTokens(999)).toBe('999');
    expect(formatContributionTokens(-500)).toBe('-500');
  });

  it('formats thousands with up to one decimal place when under 10k', () => {
    expect(formatContributionTokens(1000)).toBe('1k');
    expect(formatContributionTokens(1049)).toBe('1k');
    expect(formatContributionTokens(1050)).toBe('1.1k');
    expect(formatContributionTokens(1180)).toBe('1.2k');
    expect(formatContributionTokens(1999)).toBe('2k');
    expect(formatContributionTokens(9999)).toBe('10k');
  });

  it('formats ten-thousands and above with no decimal places', () => {
    expect(formatContributionTokens(10000)).toBe('10k');
    expect(formatContributionTokens(10499)).toBe('10k');
    expect(formatContributionTokens(10500)).toBe('11k');
    expect(formatContributionTokens(123456)).toBe('123k');
  });

  it('handles floating point numbers correctly', () => {
    expect(formatContributionTokens(1000.5)).toBe('1k');
    expect(formatContributionTokens(1500.5)).toBe('1.5k');
    expect(formatContributionTokens(10500.5)).toBe('11k');
  });
});
