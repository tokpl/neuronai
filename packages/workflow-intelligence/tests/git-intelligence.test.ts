import { describe, expect, it } from 'vitest';

import {
  createChangeClassifier,
  createCommitAnalyzer,
  createGitIntelligence,
  createRegressionDetector,
  sanitizeDiffExcerpt,
} from '../src/index.js';

describe('commit parsing / classification', () => {
  it('classifies conventional commits', () => {
    const c = createChangeClassifier();
    expect(c.classify({ message: 'feat: add checkout' })).toBe('FEATURE');
    expect(c.classify({ message: 'fix: null pointer in auth' })).toBe('BUGFIX');
    expect(c.classify({ message: 'refactor: extract payment module' })).toBe('REFACTOR');
    expect(c.classify({ message: 'docs: update README' })).toBe('DOCUMENTATION');
    expect(c.classify({ message: 'perf: reduce latency' })).toBe('PERFORMANCE');
    expect(c.classify({ message: 'security: rotate tokens' })).toBe('SECURITY');
    expect(
      c.classify({ message: 'migrate REST API to GraphQL gateway' }),
    ).toBe('ARCHITECTURE');
  });

  it('parses files from diff without storing secrets', () => {
    const diff = [
      'diff --git a/packages/api/src/a.ts b/packages/api/src/a.ts',
      '--- a/packages/api/src/a.ts',
      '+++ b/packages/api/src/a.ts',
      '+const OPENAI_KEY=sk-abcdefghijklmnopqrstuvwxyz',
    ].join('\n');
    const change = createCommitAnalyzer().analyze({
      commit: 'abc123def456789',
      message: 'feat: wire api',
      diff,
    });
    expect(change.filesChanged).toContain('packages/api/src/a.ts');
    expect(change.commit.length).toBeLessThanOrEqual(12);
    const sanitized = sanitizeDiffExcerpt(diff);
    expect(sanitized).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
  });
});

describe('timeline + evolution', () => {
  it('creates architecture transition memory REST → GraphQL', () => {
    const git = createGitIntelligence();
    const { transition } = git.ingestCommit({
      commit: 'deadbeef01',
      message: 'migrate REST API to GraphQL',
      filesChanged: ['packages/api/schema.graphql'],
      relatedDecisions: ['Adopt GraphQL gateway'],
    });
    expect(transition?.before).toBe('REST API');
    expect(transition?.after).toBe('GraphQL');
    expect(git.architectureEvolution().transitions.length).toBe(1);
  });

  it('builds engineering timeline', () => {
    const git = createGitIntelligence();
    git.ingestCommit({
      commit: '111',
      message: 'feat: payments',
      filesChanged: ['packages/payments/src/x.ts'],
    });
    const tl = git.buildTimeline({
      decisions: [{ title: 'Use Stripe', at: '2024-01-01T00:00:00.000Z' }],
    });
    expect(tl.events.some((e) => e.kind === 'commit')).toBe(true);
    expect(tl.events.some((e) => e.kind === 'decision')).toBe(true);
  });
});

describe('regression tests', () => {
  it('flags similar change to prior problem area', () => {
    const git = createGitIntelligence();
    git.ingestCommit({
      commit: 'aaa111',
      message: 'perf: add Redis cache',
      filesChanged: ['packages/cache/src/redis.ts'],
    });
    const { matches } = git.regressionCheck({
      commit: 'bbb222',
      message: 'perf: tweak Redis cache',
      filesChanged: ['packages/cache/src/redis.ts'],
      knownProblemCommits: [
        {
          commit: 'aaa111',
          problem: 'Cache stampede incident',
          files: ['packages/cache/src/redis.ts'],
        },
      ],
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.risk === 'high')).toBe(true);
  });

  it('regression detector scores module overlap', () => {
    const det = createRegressionDetector();
    const a = createCommitAnalyzer().analyze({
      commit: '1',
      message: 'fix auth',
      filesChanged: ['packages/auth/src/jwt.ts'],
    });
    const b = createCommitAnalyzer().analyze({
      commit: '2',
      message: 'fix auth again',
      filesChanged: ['packages/auth/src/jwt.ts'],
    });
    const matches = det.check(b, [a]);
    expect(matches[0]!.similarity).toBeGreaterThan(0.4);
  });
});

describe('history context', () => {
  it('explains why code is like this without blame', () => {
    const git = createGitIntelligence();
    git.ingestCommit({
      commit: 'jwtmig001',
      author: 'dev',
      message: 'migrate to JWT authentication flow',
      filesChanged: ['packages/auth/src/flow.ts'],
      relatedDecisions: ['JWT migration'],
    });
    const ctx = git.historyContext('authentication flow');
    expect(ctx.historicalReason).toMatch(/commit/i);
    expect(ctx.note).toMatch(/not people blame/i);
    expect(ctx.architectureDecision).toContain('JWT');
  });
});
