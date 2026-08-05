import type { GitChangeMemory, RegressionMatch } from './types.js';

/**
 * New change similar to a prior change that caused a problem.
 */
export class RegressionDetector {
  check(
    change: GitChangeMemory,
    history: GitChangeMemory[],
    knownProblems: Array<{ commit: string; problem: string; files?: string[] }> = [],
  ): RegressionMatch[] {
    const matches: RegressionMatch[] = [];

    for (const prior of history) {
      if (prior.id === change.id || prior.commit === change.commit) continue;
      const sim = similarity(change, prior);
      if (sim < 0.45) continue;
      const problem = knownProblems.find(
        (p) =>
          p.commit.startsWith(prior.commit) ||
          prior.commit.startsWith(p.commit) ||
          overlap(p.files ?? [], change.filesChanged) > 0,
      );
      matches.push({
        newChangeId: change.id,
        priorChangeId: prior.id,
        similarity: Math.round(sim * 100) / 100,
        reason: `Similar ${prior.changeType} touching ${sharedModules(change, prior).join(', ') || 'related files'}`,
        priorProblemHint: problem?.problem,
        risk: problem ? 'high' : sim > 0.7 ? 'medium' : 'low',
      });
    }

    // Direct problem commit similarity by files
    for (const p of knownProblems) {
      if (overlap(p.files ?? [], change.filesChanged) >= 1) {
        matches.push({
          newChangeId: change.id,
          priorChangeId: `problem:${p.commit}`,
          similarity: 0.6,
          reason: `Touches files involved in prior problem commit ${p.commit}`,
          priorProblemHint: p.problem,
          risk: 'high',
        });
      }
    }

    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }
}

function sharedModules(a: GitChangeMemory, b: GitChangeMemory): string[] {
  return a.modulesAffected.filter((m) => b.modulesAffected.includes(m));
}

function overlap(a: string[], b: string[]): number {
  const setB = new Set(b.map((x) => x.replace(/\\/g, '/')));
  return a.filter((x) => setB.has(x.replace(/\\/g, '/'))).length;
}

function similarity(a: GitChangeMemory, b: GitChangeMemory): number {
  let score = 0;
  if (a.changeType === b.changeType) score += 0.25;
  const mods = sharedModules(a, b);
  score += Math.min(0.4, mods.length * 0.15);
  score += Math.min(0.35, overlap(a.filesChanged, b.filesChanged) * 0.1);
  const wordsA = new Set(a.messageSummary.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wordsB = b.messageSummary.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const sharedWords = wordsB.filter((w) => wordsA.has(w)).length;
  score += Math.min(0.2, sharedWords * 0.05);
  return Math.min(1, score);
}

export function createRegressionDetector(): RegressionDetector {
  return new RegressionDetector();
}
