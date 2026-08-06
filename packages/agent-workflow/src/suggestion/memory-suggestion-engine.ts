import type { MemoryType } from '@neuronai/types';
import {
  classifyKnowledge,
  isPermanentCategory,
  type BrainKnowledgeCategory,
} from '@neuronai/brain';

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
  category: BrainKnowledgeCategory;
  categoryLabel: string;
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
  /** Minimum confidence for non-permanent knowledge when asking due to low confidence */
  threshold?: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isTrivialChange(analysis: CodeChangeAnalysis): boolean {
  if (analysis.hasArchitectureHint || analysis.hasAuthChange || analysis.hasSchemaChange) {
    return false;
  }
  if (analysis.impact === 'high' || analysis.impact === 'medium') return false;
  if (analysis.filesChanged > 3) return false;
  if (analysis.changeKind === 'docs' && analysis.filesChanged <= 2) return true;
  if (analysis.changeKind === 'test' || analysis.changeKind === 'config') return true;
  return analysis.impact === 'low' && analysis.filesChanged <= 2;
}

/**
 * Smart learning: ask only for permanent Brain knowledge, or low-confidence
 * non-trivial changes. Never prompt for tiny implementation details.
 */
function shouldAskUser(input: {
  force: boolean;
  confidence: number;
  permanent: boolean;
  trivial: boolean;
  lowConfidenceThreshold: number;
}): boolean {
  if (input.force) return true;
  if (input.trivial) return false;
  if (input.permanent) return true;
  // Low confidence on non-trivial work → ask
  if (input.confidence < input.lowConfidenceThreshold) return true;
  return false;
}

/**
 * Creates Project Brain *suggestions* - never writes to the store by itself.
 */
export class MemorySuggestionEngine {
  constructor(private readonly rules: WorkflowRulesEngine = createWorkflowRulesEngine()) {}

  suggest(input: SuggestionInput): MemorySuggestion {
    const lowConfidenceThreshold = input.threshold ?? 0.65;
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

    const preferred = ruleHits.find((h) => h.preferredType)?.preferredType;
    const classified = classifyKnowledge({
      memoryType: preferred,
      hasAuthChange: input.analysis.hasAuthChange,
      hasSchemaChange: input.analysis.hasSchemaChange,
      hasArchitectureHint: input.analysis.hasArchitectureHint,
      hasDependencyChange: input.analysis.hasDependencyChange,
      changeKind: input.analysis.changeKind,
      title: input.commitMessage ?? input.task,
      content: input.analysis.summary,
      task: input.task,
    });

    const force = ruleHits.some((h) => h.forceSuggest);
    const trivial = isTrivialChange(input.analysis);
    const permanent = isPermanentCategory(classified.category) || force;

    const shouldSuggest = shouldAskUser({
      force,
      confidence,
      permanent,
      trivial,
      lowConfidenceThreshold,
    });

    const reason =
      ruleHits[0]?.reason ??
      input.analysis.summary ??
      'Potentially valuable Project Brain knowledge detected';

    const title =
      input.commitMessage?.split(/\r?\n/)[0]?.trim() ||
      input.task?.slice(0, 80) ||
      input.analysis.summary;

    const draftContent = [
      input.analysis.summary,
      input.task ? `Task: ${input.task}` : undefined,
      input.analysis.modules.length
        ? `Modules: ${input.analysis.modules.join(', ')}`
        : undefined,
      `Impact: ${input.analysis.impact}; files: ${input.analysis.filesChanged}`,
      ruleHits.length ? `Signals: ${ruleHits.map((r) => r.name).join(', ')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = formatSuggestionMessage({
      shouldSuggest,
      type: classified.memoryType,
      category: classified.category,
      categoryLabel: classified.label,
      reason,
      confidence,
      analysis: input.analysis,
      title,
      draftContent,
    });

    return {
      shouldSuggest,
      type: classified.memoryType,
      category: classified.category,
      categoryLabel: classified.label,
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
