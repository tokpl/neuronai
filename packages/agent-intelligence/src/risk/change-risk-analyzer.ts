import type { ProjectIntelligenceEngine } from '@neuronai/knowledge-graph';
import type { MemoryRecord } from '@neuronai/types';

import { TaskAnalyzer } from '../context/task-analyzer.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChangeRiskReport {
  change: string;
  level: RiskLevel;
  score: number;
  reasons: string[];
  affects: string[];
}

/**
 * Estimates risk of a proposed change using heuristics + optional graph impact.
 */
export class ChangeRiskAnalyzer {
  private readonly tasks = new TaskAnalyzer();

  constructor(private readonly intelligence?: ProjectIntelligenceEngine) {}

  async analyze(
    projectId: string,
    changeDescription: string,
    memories: MemoryRecord[] = [],
  ): Promise<ChangeRiskReport> {
    const task = this.tasks.analyze(changeDescription);
    const reasons: string[] = [];
    const affects = new Set<string>(task.affectedAreas);
    let score = 0.2;

    if (/schema|migration|database|alter table/i.test(changeDescription)) {
      score += 0.35;
      reasons.push('Database schema / migration changes tend to cascade');
      affects.add('users');
      affects.add('payments');
      affects.add('reports');
    }
    if (/auth|permission|rbac|jwt|middleware/i.test(changeDescription)) {
      score += 0.25;
      reasons.push('Auth / permissions are high-blast-radius surfaces');
    }
    if (/payment|billing|wallet/i.test(changeDescription)) {
      score += 0.2;
      reasons.push('Financial flows require careful compatibility');
    }
    if (/refactor|rewrite|replace/i.test(changeDescription)) {
      score += 0.15;
      reasons.push('Large structural rewrite');
    }

    if (this.intelligence) {
      for (const area of task.affectedAreas.slice(0, 3)) {
        const impact = await this.intelligence.impactAnalysis(projectId, area);
        if (impact) {
          score = Math.max(score, impact.impactScore * 0.9);
          for (const a of impact.affected.slice(0, 8)) affects.add(a.node.name);
          reasons.push(impact.summary);
        }
      }
    }

    for (const m of memories) {
      if (m.type === 'mistake' && task.keywords.some((k) => m.content.toLowerCase().includes(k))) {
        score += 0.08;
        reasons.push(`Related past mistake: ${m.title}`);
      }
    }

    score = Math.min(1, Math.round(score * 100) / 100);
    const level: RiskLevel =
      score >= 0.85 ? 'CRITICAL' : score >= 0.65 ? 'HIGH' : score >= 0.4 ? 'MEDIUM' : 'LOW';

    return {
      change: changeDescription,
      level,
      score,
      reasons: [...new Set(reasons)].slice(0, 10),
      affects: [...affects].slice(0, 20),
    };
  }
}

export function createChangeRiskAnalyzer(
  intelligence?: ProjectIntelligenceEngine,
): ChangeRiskAnalyzer {
  return new ChangeRiskAnalyzer(intelligence);
}
