import type { MemoryRecord } from '@neuron-ai-memory/types';

import {
  newRuleId,
  nowIso,
  type ConstitutionRule,
  type RuleCategory,
} from '../rules/types.js';

export interface RuleSuggestion {
  rule: ConstitutionRule;
  evidence: string[];
}

/**
 * Propose constitution rules from memories / patterns.
 * Never emits active CRITICAL — suggestions are INFO/WARNING only.
 */
export class RuleGenerator {
  fromMemories(memories: MemoryRecord[]): RuleSuggestion[] {
    const suggestions: RuleSuggestion[] = [];
    const active = memories.filter((m) => m.status === 'active');

    for (const m of active) {
      if (m.type === 'architecture_decision') {
        suggestions.push(
          this.build({
            category: 'ARCHITECTURE',
            rule: summarizeAsRule(m),
            severity: 'WARNING',
            confidence: m.confidenceScore,
            evidence: [m.title],
            memoryIds: [m.id],
            rationale: m.content.slice(0, 280),
          }),
        );
      }
      if (m.type === 'mistake') {
        suggestions.push(
          this.build({
            category: inferSecurityOrArch(m),
            rule: `Avoid: ${m.title}. ${short(m.content, 160)}`,
            severity: 'WARNING',
            confidence: Math.max(0.55, m.confidenceScore),
            evidence: [m.title],
            memoryIds: [m.id],
            rationale: 'Learned from recorded mistake memory',
          }),
        );
      }
      if (m.type === 'pattern' || m.type === 'business_rule') {
        suggestions.push(
          this.build({
            category: 'CODING_STYLE',
            rule: `Follow project pattern: ${m.title}`,
            severity: 'INFO',
            confidence: m.confidenceScore,
            evidence: [m.title],
            memoryIds: [m.id],
          }),
        );
      }
      if (/migration|schema|postgres|sql/i.test(`${m.title} ${m.content}`)) {
        suggestions.push(
          this.build({
            category: 'DATABASE',
            rule: short(m.content, 200) || m.title,
            severity: 'INFO',
            confidence: 0.5,
            evidence: [m.title],
            memoryIds: [m.id],
          }),
        );
      }
      if (/permission|auth|rbac|secret|security/i.test(`${m.title} ${m.content}`)) {
        suggestions.push(
          this.build({
            category: 'SECURITY',
            rule: short(m.content, 200) || `Respect security constraint: ${m.title}`,
            severity: 'WARNING',
            confidence: Math.max(0.6, m.confidenceScore),
            evidence: [m.title],
            memoryIds: [m.id],
          }),
        );
      }
    }

    return dedupeSuggestions(suggestions).slice(0, 25);
  }

  fromRepeatedPattern(patternName: string, count: number, exampleNames: string[]): RuleSuggestion {
    return this.build({
      category: 'ARCHITECTURE',
      rule: `Project follows ${patternName}. New modules should match this convention.`,
      severity: count >= 10 ? 'WARNING' : 'INFO',
      confidence: Math.min(0.95, 0.4 + count * 0.04),
      evidence: exampleNames.slice(0, 8),
      rationale: `Detected ${count} similar modules/components using the same pattern.`,
    });
  }

  private build(input: {
    category: RuleCategory;
    rule: string;
    severity: ConstitutionRule['severity'];
    confidence: number;
    evidence: string[];
    memoryIds?: string[];
    rationale?: string;
  }): RuleSuggestion {
    const now = nowIso();
    return {
      evidence: input.evidence,
      rule: {
        id: newRuleId(),
        category: input.category,
        rule: input.rule,
        severity: input.severity === 'CRITICAL' ? 'WARNING' : input.severity,
        confidence: clamp01(input.confidence),
        source: 'generated',
        status: 'suggested',
        rationale: input.rationale,
        relatedMemoryIds: input.memoryIds,
        createdAt: now,
        updatedAt: now,
      },
    };
  }
}

function summarizeAsRule(m: MemoryRecord): string {
  const line = m.content.split('\n').find((l) => /decision|use |prefer|must |should /i.test(l));
  return short(line ?? m.content, 220) || m.title;
}

function inferSecurityOrArch(m: MemoryRecord): RuleCategory {
  return /permission|auth|secret|security|bypass/i.test(`${m.title} ${m.content}`)
    ? 'SECURITY'
    : 'ARCHITECTURE';
}

function short(text: string, n: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function dedupeSuggestions(items: RuleSuggestion[]): RuleSuggestion[] {
  const seen = new Set<string>();
  const out: RuleSuggestion[] = [];
  for (const s of items) {
    const key = s.rule.rule.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function createRuleGenerator(): RuleGenerator {
  return new RuleGenerator();
}
