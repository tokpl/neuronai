import { describe, it, expect } from 'vitest';
import { createGitAnalyzer } from '../../src/git/analyzer.js';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('GitAnalyzer', () => {
  it('should reject paths with null bytes immediately', async () => {
    const analyzer = createGitAnalyzer();
    const result = await analyzer.analyze('/tmp/fake\0path');
    expect(result.commitsSampled).toBe(0);
  });

  it('should not analyze a directory without a .git folder (prevents parent traversal)', async () => {
    const analyzer = createGitAnalyzer();
    const root = await mkdtemp(join(tmpdir(), 'git-analyzer-test-'));
    try {
      // Create a fake repo struct
      const fakeProject = join(root, 'project');
      await mkdir(fakeProject, { recursive: true });

      // Do not create a .git folder in fakeProject.
      const result = await analyzer.analyze(fakeProject);

      // Should reject and return empty even if the parent has a git repo
      expect(result.commitsSampled).toBe(0);
      expect(result.authors).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('should gracefully handle non-existent directories', async () => {
    const analyzer = createGitAnalyzer();
    const result = await analyzer.analyze('/tmp/does-not-exist-ever-12345');
    expect(result.commitsSampled).toBe(0);
  });
});
