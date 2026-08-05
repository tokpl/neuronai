import type { ArchitectureHealthScore, RefactoringPlan } from '../types.js';

export interface Recommendation {
  title: string;
  detail: string;
  priority: 'low' | 'medium' | 'high';
}

export function buildRecommendations(input: {
  score: ArchitectureHealthScore;
  plans: RefactoringPlan[];
  circularCount: number;
}): Recommendation[] {
  const out: Recommendation[] = [];
  if (input.circularCount) {
    out.push({
      title: 'Break circular dependencies first',
      detail: `${input.circularCount} cycle(s) detected — invert one edge via an interface.`,
      priority: 'high',
    });
  }
  if (input.score.coupling < 70) {
    out.push({
      title: 'Reduce coupling',
      detail: 'High fan-in/out modules should expose facades and shrink dependency sets.',
      priority: 'high',
    });
  }
  if (input.score.complexity < 70) {
    out.push({
      title: 'Tackle complexity hotspots',
      detail: 'Split large files/functions before adding features.',
      priority: 'medium',
    });
  }
  if (input.score.security < 75) {
    out.push({
      title: 'Restore security boundaries',
      detail: 'Ensure application paths do not bypass the security layer to storage.',
      priority: 'high',
    });
  }
  if (input.score.score >= 85) {
    out.push({
      title: 'Architecture looks healthy',
      detail: 'Keep scanning after significant refactors to catch regressions early.',
      priority: 'low',
    });
  }
  for (const p of input.plans.slice(0, 5)) {
    out.push({
      title: p.problem.slice(0, 120),
      detail: p.suggestedSteps[0] ?? p.impact,
      priority: p.estimatedEffort === 'XL' || p.estimatedEffort === 'L' ? 'high' : 'medium',
    });
  }
  return out;
}
