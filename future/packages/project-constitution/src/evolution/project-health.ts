import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { ProjectConstitutionDocument } from '../rules/types.js';

export interface HealthDimension {
  name: string;
  score: number;
  notes: string[];
}

export interface ProjectHealthReport {
  score: number;
  dimensions: HealthDimension[];
  summary: string;
}

/**
 * Heuristic project health from constitution + memories (advisor, not oracle).
 */
export class ProjectHealthAnalyzer {
  analyze(doc: ProjectConstitutionDocument, memories: MemoryRecord[]): ProjectHealthReport {
    const activeMem = memories.filter((m) => m.status === 'active');
    const activeRules = doc.rules.filter((r) => r.status === 'active');
    const suggested = doc.rules.filter((r) => r.status === 'suggested');

    const architecture = scoreArchitecture(activeRules, activeMem);
    const documentation = scoreDocs(doc, activeMem);
    const memoryQuality = scoreMemory(activeMem);
    const compliance = scoreCompliance(activeRules, suggested, doc.mistakes.length);
    const debt = scoreDebt(doc.techDebt.length);

    const dimensions = [architecture, documentation, memoryQuality, compliance, debt];
    const score = Math.round(
      dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
    );

    return {
      score,
      dimensions,
      summary: `Project Health: ${score}/100 — ${label(score)}. Active rules ${activeRules.length}, suggestions ${suggested.length}, tech-debt ${doc.techDebt.length}.`,
    };
  }
}

function scoreArchitecture(
  rules: ProjectConstitutionDocument['rules'],
  memories: MemoryRecord[],
): HealthDimension {
  const archRules = rules.filter((r) => r.category === 'ARCHITECTURE').length;
  const decisions = memories.filter((m) => m.type === 'architecture_decision').length;
  const score = clamp(40 + archRules * 8 + Math.min(decisions, 8) * 4);
  return {
    name: 'Architecture consistency',
    score,
    notes: [
      `${archRules} active architecture rules`,
      `${decisions} architecture decision memories`,
    ],
  };
}

function scoreDocs(doc: ProjectConstitutionDocument, memories: MemoryRecord[]): HealthDimension {
  const hasDecisions = doc.decisions.length > 0 || memories.some((m) => m.type === 'architecture_decision');
  const hasMistakes = doc.mistakes.length > 0;
  const score = clamp(35 + (hasDecisions ? 25 : 0) + (hasMistakes ? 10 : 0) + Math.min(doc.rules.length, 10) * 3);
  return {
    name: 'Documentation quality',
    score,
    notes: [`Constitution decisions: ${doc.decisions.length}`, `Rules total: ${doc.rules.length}`],
  };
}

function scoreMemory(memories: MemoryRecord[]): HealthDimension {
  const mistakes = memories.filter((m) => m.type === 'mistake').length;
  const patterns = memories.filter((m) => m.type === 'pattern').length;
  const avgConf =
    memories.length === 0
      ? 0.4
      : memories.reduce((s, m) => s + m.confidenceScore, 0) / memories.length;
  const score = clamp(30 + Math.min(memories.length, 40) + patterns * 2 + mistakes * 2 + avgConf * 20);
  return {
    name: 'Memory quality',
    score,
    notes: [`${memories.length} active memories`, `avg confidence ${avgConf.toFixed(2)}`],
  };
}

function scoreCompliance(
  active: number | ProjectConstitutionDocument['rules'],
  suggested: number | ProjectConstitutionDocument['rules'],
  mistakeCount: number,
): HealthDimension {
  const a = typeof active === 'number' ? active : active.length;
  const s = typeof suggested === 'number' ? suggested : suggested.length;
  const score = clamp(50 + a * 5 - Math.min(s, 10) * 2 - Math.min(mistakeCount, 10));
  return {
    name: 'Rule compliance',
    score,
    notes: [`${a} active`, `${s} pending suggestions`, `${mistakeCount} tracked mistakes`],
  };
}

function scoreDebt(count: number): HealthDimension {
  const score = clamp(95 - count * 4);
  return {
    name: 'Technical debt',
    score,
    notes: [`${count} tracked debt items`],
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function label(score: number): string {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'needs attention';
  return 'at risk';
}

export function createProjectHealthAnalyzer(): ProjectHealthAnalyzer {
  return new ProjectHealthAnalyzer();
}
