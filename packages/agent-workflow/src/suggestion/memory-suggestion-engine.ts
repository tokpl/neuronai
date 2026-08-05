import type { MemoryType } from '@neuronai/types';

import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';
import {
  createWorkflowRulesEngine,
  type WorkflowRuleHit,
  type WorkflowRulesEngine,
} from './workflow-rules.js';
import { formatSuggestionMessage, type UserPromptMessage } from './user-messages.js';

export interface MemorySuggestion {
  shouldSuggest: boolean;
  type: MemoryType;
  reason: string;
  confidence: number;
  title: string;
  draftContent: string;
  analysis: CodeChangeAnalysis;
  ruleHits: WorkflowRuleHit[];
  prompt: UserPromptMessage;
}

export interface SuggestionInput {
  analysis: CodeChangeAnalysis;
  commitMessage?: string;
  task?: string;
  /** Minimum confidence to set shouldSuggest (unless a rule forceSuggests) */
  threshold?: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function pickType(analysis: CodeChangeAnalysis, hits: WorkflowRuleHit[]): MemoryType {
  const preferred = hits.find((h) => h.preferredType)?.preferredType;
  if (preferred) return preferred;
  if (analysis.hasSchemaChange || analysis.hasAuthChange || analysis.hasArchitectureHint) {
    return 'architecture_decision';
  }
  if (analysis.hasDependencyChange) return 'dependency';
  if (analysis.changeKind === 'refactor') return 'pattern';
  if (analysis.changeKind === 'docs') return 'knowledge';
  return 'knowledge';
}

/**
 * Creates memory *suggestions* - never writes to the store by itself.
 */
export class MemorySuggestionEngine {
  constructor(private readonly rules: WorkflowRulesEngine = createWorkflowRulesEngine()) {}

  suggest(input: SuggestionInput): MemorySuggestion {
    const threshold = input.threshold ?? 0.55;
    const ruleHits = this.rules.evaluate({
      analysis: input.analysis,
      commitMessage: input.commitMessage,
    });

    let confidence = 0.35;
    if (input.analysis.impact === 'medium') confidence += 0.15;
    if (input.analysis.impact === 'high') confidence += 0.28;
    if (input.analysis.filesChanged > 5) confidence += 0.08;
    if (input.analysis.hasArchitectureHint) confidence += 0.12;
    for (const hit of ruleHits) confidence += hit.boost;
    confidence = clamp01(confidence);

    const force = ruleHits.some((h) => h.forceSuggest);
    const shouldSuggest = force || confidence >= threshold;

    const type = pickType(input.analysis, ruleHits);
    const reason =
      ruleHits[0]?.reason ??
      input.analysis.summary ??
      'Potentially valuable engineering knowledge detected';

    const title =
      input.commitMessage?.split(/\r?\n/)[0]?.trim() ||
      input.task?.slice(0, 80) ||
      input.analysis.summary;

    const draftContent = [
      input.analysis.summary,
      input.commitMessage ? `Commit: ${input.commitMessage.trim()}` : undefined,
      input.task ? `Task: ${input.task}` : undefined,
      input.analysis.modules.length
        ? `Modules: ${input.analysis.modules.join(', ')}`
        : undefined,
      `Impact: ${input.analysis.impact}; files: ${input.analysis.filesChanged}`,
      ruleHits.length ? `Rules: ${ruleHits.map((r) => r.ruleId).join(', ')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = formatSuggestionMessage({
      shouldSuggest,
      type,
      reason,
      analysis: input.analysis,
      title,
    });

    return {
      shouldSuggest,
      type,
      reason,
      confidence,
      title,
      draftContent,
      analysis: input.analysis,
      ruleHits,
      prompt,
    };
  }
}

export function createMemorySuggestionEngine(
  rules?: WorkflowRulesEngine,
): MemorySuggestionEngine {
  return new MemorySuggestionEngine(rules);
}
