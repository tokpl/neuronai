import type { MemoryEngine } from '@neuronai/memory-engine';
import type { MemoryRecord } from '@neuronai/types';

import { CodeChangeAnalyzer, type CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';
import {
  createPrivacyPolicy,
  shouldAutoPersist,
  shouldEmitSuggestion,
  type PrivacyMode,
  type PrivacyPolicy,
} from '../privacy/privacy-mode.js';
import {
  createMemoryQualityChecker,
  type MemoryQualityChecker,
  type QualityCheckResult,
} from '../quality/memory-quality-checker.js';
import {
  createMemorySuggestionEngine,
  type MemorySuggestion,
  type MemorySuggestionEngine,
} from '../suggestion/memory-suggestion-engine.js';
import type { SuggestionAskQuestion } from '../suggestion/user-messages.js';

export interface AfterCodingResult {
  analysis: CodeChangeAnalysis;
  suggestion: MemorySuggestion | null;
  quality: QualityCheckResult | null;
  persisted: MemoryRecord | null;
  promptText: string | null;
  /** Options for the host's own question UI (Cursor AskQuestion). */
  askQuestion: SuggestionAskQuestion | null;
}

export interface AgentWorkflowDeps {
  projectId: string;
  privacy?: PrivacyMode | PrivacyPolicy;
  engine?: MemoryEngine;
  suggestionEngine?: MemorySuggestionEngine;
  qualityChecker?: MemoryQualityChecker;
  changeAnalyzer?: CodeChangeAnalyzer;
  listExistingMemories?: () => Promise<MemoryRecord[]>;
}

/**
 * Ask-before-remember: analyze what changed, decide whether it is worth keeping,
 * and let the user answer before anything is written.
 */
export class AgentWorkflowOrchestrator {
  readonly privacy: PrivacyPolicy;
  private readonly analyzer: CodeChangeAnalyzer;
  private readonly suggestions: MemorySuggestionEngine;
  private readonly quality: MemoryQualityChecker;
  private readonly engine?: MemoryEngine;
  private readonly listExisting: () => Promise<MemoryRecord[]>;

  constructor(private readonly deps: AgentWorkflowDeps) {
    this.privacy =
      typeof deps.privacy === 'string' || deps.privacy === undefined
        ? createPrivacyPolicy(deps.privacy ?? 'suggest')
        : deps.privacy;
    this.analyzer = deps.changeAnalyzer ?? new CodeChangeAnalyzer();
    this.suggestions = deps.suggestionEngine ?? createMemorySuggestionEngine();
    this.quality = deps.qualityChecker ?? createMemoryQualityChecker();
    this.engine = deps.engine;
    this.listExisting = deps.listExistingMemories ?? (async () => []);
  }

  /** After coding: analyze changes, propose knowledge, auto-save only if privacy allows. */
  async afterCoding(input: {
    task?: string;
    summary?: string;
    diff?: string;
    files?: string[];
    commitMessage?: string;
  }): Promise<AfterCodingResult> {
    const task = input.task ?? 'untitled task';
    const analysis = this.analyzer.analyze({
      diff: input.diff,
      files: input.files,
      message: input.commitMessage ?? input.summary,
    });

    const empty: AfterCodingResult = {
      analysis,
      suggestion: null,
      quality: null,
      persisted: null,
      promptText: null,
      askQuestion: null,
    };

    if (!shouldEmitSuggestion(this.privacy)) return empty;

    const suggestion = this.suggestions.suggest({
      analysis,
      commitMessage: input.commitMessage,
      task,
    });
    if (!suggestion.shouldSuggest) return empty;

    const quality = this.quality.check({
      title: suggestion.title,
      content: suggestion.draftContent,
      type: suggestion.type,
      confidence: suggestion.confidence,
      existing: await this.listExisting(),
    });

    // Already-known knowledge is not worth asking about.
    if (quality.recommendation === 'reject') {
      return { ...empty, analysis, quality };
    }

    let persisted: MemoryRecord | null = null;
    if (
      shouldAutoPersist(this.privacy, suggestion.confidence, quality.recommendation === 'accept') &&
      this.engine
    ) {
      persisted = await this.engine.createMemory({
        projectId: this.deps.projectId,
        type: suggestion.type,
        title: suggestion.title,
        content: suggestion.draftContent,
        source: 'agent',
        tags: ['auto-capture', ...analysis.signals],
        manualImportance: suggestion.confidence,
        confidence: suggestion.confidence,
      });
    }

    return {
      analysis,
      suggestion,
      quality,
      persisted,
      promptText: suggestion.prompt.text,
      askQuestion: suggestion.prompt.askQuestion,
    };
  }
}

export function createAgentWorkflow(deps: AgentWorkflowDeps): AgentWorkflowOrchestrator {
  return new AgentWorkflowOrchestrator(deps);
}
