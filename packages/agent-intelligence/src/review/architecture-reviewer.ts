import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { AgentContext } from '../context/context-engine.js';
import { ChangeRiskAnalyzer, type ChangeRiskReport } from '../risk/change-risk-analyzer.js';
import type { ProjectIntelligenceEngine } from '@neuron-ai-memory/knowledge-graph';

export interface ArchitectureReview {
  score: number;
  issues: string[];
  recommendations: string[];
  risk?: ChangeRiskReport;
  alignedDecisions: string[];
  conflicts: string[];
}

/**
 * Reviews a proposed implementation against graph + decisions + patterns.
 */
export class ArchitectureReviewer {
  private readonly risk: ChangeRiskAnalyzer;

  constructor(intelligence?: ProjectIntelligenceEngine) {
    this.risk = new ChangeRiskAnalyzer(intelligence);
  }

  async review(input: {
    projectId: string;
    changeDescription: string;
    context?: AgentContext;
    memories?: MemoryRecord[];
  }): Promise<ArchitectureReview> {
    const memories = input.memories ?? [];
    const risk = await this.risk.analyze(input.projectId, input.changeDescription, memories);
    const issues: string[] = [];
    const recommendations: string[] = [];
    const alignedDecisions: string[] = [];
    const conflicts: string[] = [];

    let score = 78;

    if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
      score -= risk.level === 'CRITICAL' ? 25 : 15;
      issues.push(`Elevated change risk (${risk.level}): ${risk.reasons[0] ?? 'see risk report'}`);
      recommendations.push('Add an explicit migration / rollback plan before coding');
    }

    for (const warning of input.context?.warnings ?? []) {
      if (new RegExp(warning.split(/\s+/).slice(0, 3).join('|'), 'i').test(input.changeDescription)) {
        score -= 10;
        issues.push(`May violate warning: ${warning}`);
        conflicts.push(warning);
      }
    }

    for (const decision of input.context?.decisions ?? []) {
      alignedDecisions.push(decision.title);
      if (/bypass|replace middleware|drop rbac/i.test(input.changeDescription)) {
        score -= 20;
        issues.push(`Conflicts with decision: ${decision.title}`);
        conflicts.push(decision.title);
      }
    }

    for (const m of memories.filter((x) => x.type === 'pattern')) {
      recommendations.push(`Follow pattern: ${m.title}`);
    }

    if (!issues.length) {
      recommendations.push('Looks compatible with known architecture — keep modules cohesive');
    } else {
      recommendations.push('Search Neuron memories for the affected module before merging');
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      issues,
      recommendations: [...new Set(recommendations)].slice(0, 10),
      risk,
      alignedDecisions: alignedDecisions.slice(0, 8),
      conflicts,
    };
  }
}

export function createArchitectureReviewer(
  intelligence?: ProjectIntelligenceEngine,
): ArchitectureReviewer {
  return new ArchitectureReviewer(intelligence);
}
